import { omit, reject } from 'lodash';

import { normalize } from '../../types/PhoneNumber';
import { trigger } from '../../shims/events';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import {
  searchConversations,
  searchMessages,
  searchMessagesInConversation,
} from '../../../js/modules/data';
import { makeLookup } from '../../util/makeLookup';

import {
  ConversationType,
  MessageDeletedActionType,
  MessageType,
  RemoveAllConversationsActionType,
  SelectedConversationChangedActionType,
} from './conversations';

// State

export type MessageSearchResultType = MessageType & {
  snippet: string;
};

export type MessageSearchResultLookupType = {
  [id: string]: MessageSearchResultType;
};

export type SearchStateType = {
  searchConversationId?: string;
  searchConversationName?: string;
  // We store just ids of conversations, since that data is always cached in memory
  contacts: Array<string>;
  conversations: Array<string>;
  query: string;
  normalizedPhoneNumber?: string;
  messageIds: Array<string>;
  // We do store message data to pass through the selector
  messageLookup: MessageSearchResultLookupType;
  selectedMessage?: string;
};

// Actions

type SearchResultsPayloadType = {
  query: string;
  normalizedPhoneNumber?: string;
  messages: Array<MessageSearchResultType>;
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
type ClearConversationSearchActionType = {
  type: 'CLEAR_CONVERSATION_SEARCH';
  payload: null;
};
type SearchInConversationActionType = {
  type: 'SEARCH_IN_CONVERSATION';
  payload: {
    searchConversationId: string;
    searchConversationName: string;
  };
};

export type SEARCH_TYPES =
  | SearchResultsFulfilledActionType
  | UpdateSearchTermActionType
  | ClearSearchActionType
  | ClearConversationSearchActionType
  | SearchInConversationActionType
  | MessageDeletedActionType
  | RemoveAllConversationsActionType
  | SelectedConversationChangedActionType;

// Action Creators

export const actions = {
  search,
  clearSearch,
  clearConversationSearch,
  searchInConversation,
  updateSearchTerm,
  startNewConversation,
};

function search(
  query: string,
  options: {
    searchConversationId?: string;
    regionCode: string;
    ourNumber: string;
    noteToSelf: string;
  }
): SearchResultsKickoffActionType {
  return {
    type: 'SEARCH_RESULTS',
    payload: doSearch(query, options),
  };
}

async function doSearch(
  query: string,
  options: {
    searchConversationId?: string;
    regionCode: string;
    ourNumber: string;
    noteToSelf: string;
  }
): Promise<SearchResultsPayloadType> {
  const { regionCode, ourNumber, noteToSelf, searchConversationId } = options;
  const normalizedPhoneNumber = normalize(query, { regionCode });

  if (searchConversationId) {
    const messages = await queryMessages(query, searchConversationId);

    return {
      contacts: [],
      conversations: [],
      messages,
      normalizedPhoneNumber,
      query,
    };
  } else {
    const [discussions, messages] = await Promise.all([
      queryConversationsAndContacts(query, { ourNumber, noteToSelf }),
      queryMessages(query),
    ]);
    const { conversations, contacts } = discussions;

    return {
      contacts,
      conversations,
      messages,
      normalizedPhoneNumber,
      query,
    };
  }
}
function clearSearch(): ClearSearchActionType {
  return {
    type: 'SEARCH_CLEAR',
    payload: null,
  };
}
function clearConversationSearch(): ClearConversationSearchActionType {
  return {
    type: 'CLEAR_CONVERSATION_SEARCH',
    payload: null,
  };
}
function searchInConversation(
  searchConversationId: string,
  searchConversationName: string
): SearchInConversationActionType {
  return {
    type: 'SEARCH_IN_CONVERSATION',
    payload: {
      searchConversationId,
      searchConversationName,
    },
  };
}

function updateSearchTerm(query: string): UpdateSearchTermActionType {
  return {
    type: 'SEARCH_UPDATE',
    payload: {
      query,
    },
  };
}
function startNewConversation(
  query: string,
  options: { regionCode: string }
): ClearSearchActionType {
  const { regionCode } = options;
  const normalized = normalize(query, { regionCode });
  if (!normalized) {
    throw new Error('Attempted to start new conversation with invalid number');
  }
  trigger('showConversation', normalized);

  return {
    type: 'SEARCH_CLEAR',
    payload: null,
  };
}

async function queryMessages(query: string, searchConversationId?: string) {
  try {
    const normalized = cleanSearchTerm(query);

    if (searchConversationId) {
      return searchMessagesInConversation(normalized, searchConversationId);
    }

    return searchMessages(normalized);
  } catch (e) {
    return [];
  }
}

async function queryConversationsAndContacts(
  providedQuery: string,
  options: { ourNumber: string; noteToSelf: string }
) {
  const { ourNumber, noteToSelf } = options;
  const query = providedQuery.replace(/[+-.()]*/g, '');

  const searchResults: Array<ConversationType> = await searchConversations(
    query
  );

  // Split into two groups - active conversations and items just from address book
  let conversations: Array<string> = [];
  let contacts: Array<string> = [];
  const max = searchResults.length;
  for (let i = 0; i < max; i += 1) {
    const conversation = searchResults[i];

    if (conversation.type === 'direct' && !Boolean(conversation.lastMessage)) {
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
    messageIds: [],
    messageLookup: {},
    conversations: [],
    contacts: [],
  };
}

// tslint:disable-next-line max-func-body-length
export function reducer(
  state: SearchStateType = getEmptyState(),
  action: SEARCH_TYPES
): SearchStateType {
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

  if (action.type === 'SEARCH_IN_CONVERSATION') {
    const { payload } = action;
    const { searchConversationId, searchConversationName } = payload;

    if (searchConversationId === state.searchConversationId) {
      return state;
    }

    return {
      ...getEmptyState(),
      searchConversationId,
      searchConversationName,
    };
  }
  if (action.type === 'CLEAR_CONVERSATION_SEARCH') {
    const { searchConversationId, searchConversationName } = state;

    return {
      ...getEmptyState(),
      searchConversationId,
      searchConversationName,
    };
  }

  if (action.type === 'SEARCH_RESULTS_FULFILLED') {
    const { payload } = action;
    const {
      contacts,
      conversations,
      messages,
      normalizedPhoneNumber,
      query,
    } = payload;

    // Reject if the associated query is not the most recent user-provided query
    if (state.query !== query) {
      return state;
    }

    const messageIds = messages.map(message => message.id);

    return {
      ...state,
      contacts,
      conversations,
      normalizedPhoneNumber,
      query,
      messageIds,
      messageLookup: makeLookup(messages, 'id'),
    };
  }

  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }

  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id, messageId } = payload;
    const { searchConversationId } = state;

    if (searchConversationId && searchConversationId !== id) {
      return getEmptyState();
    }

    return {
      ...state,
      selectedMessage: messageId,
    };
  }

  if (action.type === 'MESSAGE_DELETED') {
    const { messageIds, messageLookup } = state;
    if (!messageIds || messageIds.length < 1) {
      return state;
    }

    const { payload } = action;
    const { id } = payload;

    return {
      ...state,
      messageIds: reject(messageIds, messageId => id === messageId),
      messageLookup: omit(messageLookup, ['id']),
    };
  }

  return state;
}
