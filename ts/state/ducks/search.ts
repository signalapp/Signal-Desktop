/* eslint-disable no-restricted-syntax */
import _, { isNaN } from 'lodash';
import { Data } from '../../data/data';
import { AdvancedSearchOptions, SearchOptions } from '../../types/Search';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';

import { MessageResultProps } from '../../components/search/MessageSearchResults';
import { ConversationTypeEnum } from '../../models/conversationAttributes';
import { PubKey } from '../../session/types';
import { UserUtils } from '../../session/utils';
import { ReduxConversationType } from './conversations';

// State

export type SearchStateType = {
  query: string;
  normalizedPhoneNumber?: string;
  // For conversations we store just the id, and pull conversation props in the selector
  contactsAndGroups: Array<string>;
  messages?: Array<MessageResultProps>;
};

// Actions
type SearchResultsPayloadType = {
  query: string;
  normalizedPhoneNumber?: string;
  contactsAndGroups: Array<string>;
  messages?: Array<MessageResultProps>;
};

type SearchResultsKickoffActionType = {
  type: 'SEARCH_RESULTS';
  payload: Promise<SearchResultsPayloadType>;
};
type SearchResultsFulfilledActionType = {
  type: 'SEARCH_RESULTS_FULFILLED';
  payload: SearchResultsPayloadType;
};
type UpdateSearchTermActionType = {
  type: 'SEARCH_UPDATE';
  payload: {
    query: string;
  };
};
type ClearSearchActionType = {
  type: 'SEARCH_CLEAR';
  payload: null;
};

export type SEARCH_TYPES =
  | SearchResultsFulfilledActionType
  | UpdateSearchTermActionType
  | ClearSearchActionType;

// Action Creators

export const actions = {
  search,
  clearSearch,
  updateSearchTerm,
};

export function search(query: string): SearchResultsKickoffActionType {
  return {
    type: 'SEARCH_RESULTS',
    payload: doSearch(query), // this uses redux-promise-middleware
  };
}

async function doSearch(query: string): Promise<SearchResultsPayloadType> {
  const options: SearchOptions = {
    noteToSelf: window.i18n('noteToSelf').toLowerCase(),
    savedMessages: window.i18n('savedMessages').toLowerCase(),
    ourNumber: UserUtils.getOurPubKeyStrFromCache(),
  };
  const advancedSearchOptions = getAdvancedSearchOptionsFromQuery(query);
  const processedQuery = advancedSearchOptions.query;
  // const isAdvancedQuery = query !== processedQuery;

  const [discussions, messages] = await Promise.all([
    queryConversationsAndContacts(processedQuery, options),
    queryMessages(processedQuery),
  ]);
  const { conversations, contacts } = discussions;
  const contactsAndGroups = _.uniq([...conversations, ...contacts]);
  const filteredMessages = _.compact(messages);

  return {
    query,
    normalizedPhoneNumber: PubKey.normalize(query),
    contactsAndGroups,
    messages: filteredMessages,
  };
}
export function clearSearch(): ClearSearchActionType {
  return {
    type: 'SEARCH_CLEAR',
    payload: null,
  };
}
export function updateSearchTerm(query: string): UpdateSearchTermActionType {
  return {
    type: 'SEARCH_UPDATE',
    payload: {
      query,
    },
  };
}

// Helper functions for search

// function advancedFilterMessages(
//   messages: Array<MessageResultProps>,
//   filters: AdvancedSearchOptions,
//   contacts: Array<string>
// ): Array<MessageResultProps> {
//   let filteredMessages = messages;
//   if (filters.from && filters.from.length > 0) {
//     if (filters.from === '@me') {
//       filteredMessages = filteredMessages.filter(message => message.sent);
//     } else {
//       filteredMessages = [];
//       for (const contact of contacts) {
//         for (const message of messages) {
//           if (message.source === contact) {
//             filteredMessages.push(message);
//           }
//         }
//       }
//     }
//   }
//   if (filters.before > 0) {
//     filteredMessages = filteredMessages.filter(message => message.received_at < filters.before);
//   }
//   if (filters.after > 0) {
//     filteredMessages = filteredMessages.filter(message => message.received_at > filters.after);
//   }

//   return filteredMessages;
// }

function getUnixMillisecondsTimestamp(timestamp: string): number {
  const timestampInt = parseInt(timestamp, 10);
  if (!isNaN(timestampInt)) {
    try {
      if (timestampInt > 10000) {
        return new Date(timestampInt).getTime();
      }

      return new Date(timestamp).getTime();
    } catch (error) {
      window?.log?.warn('Advanced Search: ', error);

      return 0;
    }
  }

  return 0;
}

function getAdvancedSearchOptionsFromQuery(query: string): AdvancedSearchOptions {
  const filterSeperator = ':';
  const filters: any = {
    query: null,
    from: null,
    before: null,
    after: null,
  };

  let newQuery = query;
  const splitQuery = query.toLowerCase().split(' ');
  const filtersList = Object.keys(filters);
  for (const queryPart of splitQuery) {
    for (const filter of filtersList) {
      const filterMatcher = filter + filterSeperator;
      if (queryPart.startsWith(filterMatcher)) {
        filters[filter] = queryPart.replace(filterMatcher, '');
        newQuery = newQuery.replace(queryPart, '').trim();
      }
    }
  }

  filters.before = getUnixMillisecondsTimestamp(filters.before);
  filters.after = getUnixMillisecondsTimestamp(filters.after);
  filters.query = newQuery;

  return filters;
}

async function queryMessages(query: string): Promise<Array<MessageResultProps>> {
  try {
    const trimmedQuery = query.trim();
    const normalized = cleanSearchTerm(trimmedQuery);
    // 200 on a large database is already pretty slow
    const limit = Math.min((trimmedQuery.length || 2) * 50, 200);
    return Data.searchMessages(normalized, limit);
  } catch (e) {
    window.log.warn('queryMessages failed with', e.message);
    return [];
  }
}

async function queryConversationsAndContacts(providedQuery: string, options: SearchOptions) {
  const { ourNumber, noteToSelf, savedMessages } = options;
  const query = providedQuery.replace(/[+-.()]*/g, '');

  const searchResults: Array<ReduxConversationType> = await Data.searchConversations(query);

  // Split into two groups - active conversations and items just from address book
  let conversations: Array<string> = [];
  let contacts: Array<string> = [];
  const max = searchResults.length;
  for (let i = 0; i < max; i += 1) {
    const conversation = searchResults[i];

    if (conversation.id && conversation.activeAt) {
      if (conversation.id === ourNumber) {
        conversations.push(ourNumber);
      } else {
        conversations.push(conversation.id);
      }
    } else if (conversation.type === ConversationTypeEnum.PRIVATE) {
      contacts.push(conversation.id);
    } else {
      conversations.push(conversation.id);
    }
  }

  const queryLowered = providedQuery.toLowerCase();
  // Inject synthetic Note to Self entry if query matches localized 'Note to Self'
  if (noteToSelf.includes(queryLowered) || savedMessages.includes(queryLowered)) {
    // Ensure that we don't have duplicates in our results
    contacts = contacts.filter(id => id !== ourNumber);
    conversations = conversations.filter(id => id !== ourNumber);

    contacts.unshift(ourNumber);
  }

  return { conversations, contacts };
}

// Reducer

export const initialSearchState: SearchStateType = {
  query: '',
  contactsAndGroups: [],
  messages: [],
};

function getEmptyState(): SearchStateType {
  return initialSearchState;
}

export function reducer(state: SearchStateType | undefined, action: SEARCH_TYPES): SearchStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'SEARCH_CLEAR') {
    return getEmptyState();
  }

  if (action.type === 'SEARCH_UPDATE') {
    const { payload } = action;
    const { query } = payload;

    return {
      ...state,
      query,
    };
  }

  if (action.type === 'SEARCH_RESULTS_FULFILLED') {
    const { payload } = action;
    const { query, normalizedPhoneNumber, contactsAndGroups, messages } = payload;
    // Reject if the associated query is not the most recent user-provided query
    if (state.query !== query) {
      return state;
    }

    return {
      ...state,
      query,
      normalizedPhoneNumber,
      contactsAndGroups,
      messages,
    };
  }

  return state;
}
