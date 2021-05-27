import { omit, reject } from 'lodash';

import { AdvancedSearchOptions, SearchOptions } from '../../types/Search';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { searchConversations, searchMessages } from '../../../ts/data/data';
import { makeLookup } from '../../util/makeLookup';

import {
  ConversationType,
  MessageExpiredActionType,
  MessageType,
  RemoveAllConversationsActionType,
  SelectedConversationChangedActionType,
} from './conversations';
import { PubKey } from '../../session/types';
import { MessageModel } from '../../models/message';
import { MessageModelType } from '../../models/messageType';
import { ConversationTypeEnum } from '../../models/conversation';

// State

export type SearchStateType = {
  query: string;
  normalizedPhoneNumber?: string;
  // We need to store messages here, because they aren't anywhere else in state
  messages: Array<MessageType>;
  selectedMessage?: string;
  messageLookup: {
    [key: string]: MessageType;
  };
  // For conversations we store just the id, and pull conversation props in the selector
  conversations: Array<string>;
  contacts: Array<string>;
};

// Actions
type SearchResultsPayloadType = {
  query: string;
  normalizedPhoneNumber?: string;
  messages: Array<MessageType>;
  conversations: Array<string>;
  contacts: Array<string>;
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
  | ClearSearchActionType
  | MessageExpiredActionType
  | RemoveAllConversationsActionType
  | SelectedConversationChangedActionType;

// Action Creators

export const actions = {
  search,
  clearSearch,
  updateSearchTerm,
};

export function search(query: string, options: SearchOptions): SearchResultsKickoffActionType {
  return {
    type: 'SEARCH_RESULTS',
    payload: doSearch(query, options),
  };
}

async function doSearch(query: string, options: SearchOptions): Promise<SearchResultsPayloadType> {
  const advancedSearchOptions = getAdvancedSearchOptionsFromQuery(query);
  const processedQuery = advancedSearchOptions.query;
  const isAdvancedQuery = query !== processedQuery;

  const [discussions, messages] = await Promise.all([
    queryConversationsAndContacts(processedQuery, options),
    queryMessages(processedQuery),
  ]);
  const { conversations, contacts } = discussions;
  let filteredMessages = messages.filter(message => message !== undefined);

  if (isAdvancedQuery) {
    let senderFilter: Array<string> = [];
    if (advancedSearchOptions.from && advancedSearchOptions.from.length > 0) {
      const senderFilterQuery = await queryConversationsAndContacts(
        advancedSearchOptions.from,
        options
      );
      senderFilter = senderFilterQuery.contacts;
    }
    filteredMessages = filterMessages(filteredMessages, advancedSearchOptions, senderFilter);
  }

  return {
    query,
    normalizedPhoneNumber: PubKey.normalize(query),
    conversations,
    contacts,
    messages: getMessageProps(filteredMessages) || [],
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

function filterMessages(
  messages: Array<any>,
  filters: AdvancedSearchOptions,
  contacts: Array<string>
) {
  let filteredMessages = messages;
  if (filters.from && filters.from.length > 0) {
    if (filters.from === '@me') {
      filteredMessages = filteredMessages.filter(message => message.sent);
    } else {
      filteredMessages = [];
      for (const contact of contacts) {
        for (const message of messages) {
          if (message.source === contact) {
            filteredMessages.push(message);
          }
        }
      }
    }
  }
  if (filters.before > 0) {
    filteredMessages = filteredMessages.filter(message => message.received_at < filters.before);
  }
  if (filters.after > 0) {
    filteredMessages = filteredMessages.filter(message => message.received_at > filters.after);
  }

  return filteredMessages;
}

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

const getMessageProps = (messages: Array<MessageType>) => {
  if (!messages || !messages.length) {
    return [];
  }

  return messages.map(message => {
    const overridenProps = {
      ...message,
      type: 'incoming' as MessageModelType,
    };

    const model = new MessageModel(overridenProps);

    return model.propsForSearchResult;
  });
};

async function queryMessages(query: string) {
  try {
    const normalized = cleanSearchTerm(query);

    return searchMessages(normalized);
  } catch (e) {
    return [];
  }
}

async function queryConversationsAndContacts(providedQuery: string, options: SearchOptions) {
  const { ourNumber, noteToSelf } = options;
  const query = providedQuery.replace(/[+-.()]*/g, '');

  const searchResults: Array<ConversationType> = await searchConversations(query);

  // Split into two groups - active conversations and items just from address book
  let conversations: Array<string> = [];
  let contacts: Array<string> = [];
  const max = searchResults.length;
  for (let i = 0; i < max; i += 1) {
    const conversation = searchResults[i];
    const primaryDevice = searchResults[i].id;

    if (primaryDevice) {
      if (primaryDevice === ourNumber) {
        conversations.push(ourNumber);
      } else {
        conversations.push(primaryDevice);
      }
    } else if (conversation.type === ConversationTypeEnum.PRIVATE) {
      contacts.push(conversation.id);
    } else if (conversation.type !== ConversationTypeEnum.GROUP) {
      contacts.push(conversation.id);
    } else {
      conversations.push(conversation.id);
    }
  }
  // Inject synthetic Note to Self entry if query matches localized 'Note to Self'
  if (noteToSelf.indexOf(providedQuery.toLowerCase()) !== -1) {
    // ensure that we don't have duplicates in our results
    contacts = contacts.filter(id => id !== ourNumber);
    conversations = conversations.filter(id => id !== ourNumber);

    contacts.unshift(ourNumber);
  }

  return { conversations, contacts };
}

// Reducer

function getEmptyState(): SearchStateType {
  return {
    query: '',
    messages: [],
    messageLookup: {},
    conversations: [],
    contacts: [],
  };
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
    const { query, messages, normalizedPhoneNumber, conversations, contacts } = payload;

    // Reject if the associated query is not the most recent user-provided query
    if (state.query !== query) {
      return state;
    }
    const filteredMessage = messages.filter(message => message !== undefined);

    return {
      ...state,
      query,
      normalizedPhoneNumber,
      conversations,
      contacts,
      messages: filteredMessage,
      messageLookup: makeLookup(filteredMessage, 'id'),
    };
  }

  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }

  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { messageId } = payload;

    if (!messageId) {
      return state;
    }

    return {
      ...state,
      selectedMessage: messageId,
    };
  }

  if (action.type === 'MESSAGE_EXPIRED') {
    const { messages, messageLookup } = state;
    if (!messages.length) {
      return state;
    }

    const { payload } = action;
    const { messageId } = payload;

    return {
      ...state,
      messages: reject(messages, message => messageId === message.id),
      messageLookup: omit(messageLookup, ['id']),
    };
  }

  return state;
}
