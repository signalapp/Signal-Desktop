import { omit, reject } from 'lodash';

import { normalize } from '../../types/PhoneNumber';
import { trigger } from '../../shims/events';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import {
  searchConversations as dataSearchConversations,
  searchMessages as dataSearchMessages,
  searchMessagesInConversation,
} from '../../../js/modules/data';
import { makeLookup } from '../../util/makeLookup';

import {
  ConversationType,
  ConversationUnloadedActionType,
  MessageDeletedActionType,
  MessageType,
  RemoveAllConversationsActionType,
  SelectedConversationChangedActionType,
  ShowArchivedConversationsActionType,
} from './conversations';

// State

export type MessageSearchResultType = MessageType & {
  snippet: string;
};

export type MessageSearchResultLookupType = {
  [id: string]: MessageSearchResultType;
};

export type SearchStateType = {
  startSearchCounter: number;
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
  // Loading state
  discussionsLoading: boolean;
  messagesLoading: boolean;
};

// Actions

type SearchResultsBaseType = {
  query: string;
  normalizedPhoneNumber?: string;
};
type SearchMessagesResultsPayloadType = SearchResultsBaseType & {
  messages: Array<MessageSearchResultType>;
};
type SearchDiscussionsResultsPayloadType = SearchResultsBaseType & {
  conversations: Array<string>;
  contacts: Array<string>;
};
type SearchMessagesResultsKickoffActionType = {
  type: 'SEARCH_MESSAGES_RESULTS';
  payload: Promise<SearchMessagesResultsPayloadType>;
};
type SearchDiscussionsResultsKickoffActionType = {
  type: 'SEARCH_DISCUSSIONS_RESULTS';
  payload: Promise<SearchDiscussionsResultsPayloadType>;
};

type SearchMessagesResultsFulfilledActionType = {
  type: 'SEARCH_MESSAGES_RESULTS_FULFILLED';
  payload: SearchMessagesResultsPayloadType;
};
type SearchDiscussionsResultsFulfilledActionType = {
  type: 'SEARCH_DISCUSSIONS_RESULTS_FULFILLED';
  payload: SearchDiscussionsResultsPayloadType;
};
type UpdateSearchTermActionType = {
  type: 'SEARCH_UPDATE';
  payload: {
    query: string;
  };
};
type StartSearchActionType = {
  type: 'SEARCH_START';
  payload: null;
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
  | SearchMessagesResultsKickoffActionType
  | SearchDiscussionsResultsKickoffActionType
  | SearchMessagesResultsFulfilledActionType
  | SearchDiscussionsResultsFulfilledActionType
  | UpdateSearchTermActionType
  | StartSearchActionType
  | ClearSearchActionType
  | ClearConversationSearchActionType
  | SearchInConversationActionType
  | MessageDeletedActionType
  | RemoveAllConversationsActionType
  | SelectedConversationChangedActionType
  | ShowArchivedConversationsActionType
  | ConversationUnloadedActionType;

// Action Creators

export const actions = {
  searchMessages,
  searchDiscussions,
  startSearch,
  clearSearch,
  clearConversationSearch,
  searchInConversation,
  updateSearchTerm,
  startNewConversation,
};

function searchMessages(
  query: string,
  options: {
    regionCode: string;
  }
): SearchMessagesResultsKickoffActionType {
  return {
    type: 'SEARCH_MESSAGES_RESULTS',
    payload: doSearchMessages(query, options),
  };
}

function searchDiscussions(
  query: string,
  options: {
    ourNumber: string;
    noteToSelf: string;
  }
): SearchDiscussionsResultsKickoffActionType {
  return {
    type: 'SEARCH_DISCUSSIONS_RESULTS',
    payload: doSearchDiscussions(query, options),
  };
}

async function doSearchMessages(
  query: string,
  options: {
    searchConversationId?: string;
    regionCode: string;
  }
): Promise<SearchMessagesResultsPayloadType> {
  const { regionCode, searchConversationId } = options;
  const normalizedPhoneNumber = normalize(query, { regionCode });

  const messages = await queryMessages(query, searchConversationId);

  return {
    messages,
    normalizedPhoneNumber,
    query,
  };
}

async function doSearchDiscussions(
  query: string,
  options: {
    ourNumber: string;
    noteToSelf: string;
  }
): Promise<SearchDiscussionsResultsPayloadType> {
  const { ourNumber, noteToSelf } = options;
  const { conversations, contacts } = await queryConversationsAndContacts(
    query,
    {
      ourNumber,
      noteToSelf,
    }
  );

  return {
    conversations,
    contacts,
    query,
  };
}
function startSearch(): StartSearchActionType {
  return {
    type: 'SEARCH_START',
    payload: null,
  };
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

    return dataSearchMessages(normalized);
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

  const searchResults: Array<ConversationType> = await dataSearchConversations(
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
    startSearchCounter: 0,
    query: '',
    messageIds: [],
    messageLookup: {},
    conversations: [],
    contacts: [],
    discussionsLoading: false,
    messagesLoading: false,
  };
}

// tslint:disable-next-line cyclomatic-complexity max-func-body-length
export function reducer(
  state: SearchStateType = getEmptyState(),
  action: SEARCH_TYPES
): SearchStateType {
  if (action.type === 'SHOW_ARCHIVED_CONVERSATIONS') {
    return getEmptyState();
  }

  if (action.type === 'SEARCH_START') {
    return {
      ...state,
      searchConversationId: undefined,
      searchConversationName: undefined,
      startSearchCounter: state.startSearchCounter + 1,
    };
  }

  if (action.type === 'SEARCH_CLEAR') {
    return getEmptyState();
  }

  if (action.type === 'SEARCH_UPDATE') {
    const { payload } = action;
    const { query } = payload;

    const hasQuery = Boolean(query && query.length >= 2);
    const isWithinConversation = Boolean(state.searchConversationId);

    return {
      ...state,
      query,
      messagesLoading: hasQuery,
      ...(hasQuery
        ? {
            messageIds: [],
            messageLookup: {},
            discussionsLoading: !isWithinConversation,
            contacts: [],
            conversations: [],
          }
        : {}),
    };
  }

  if (action.type === 'SEARCH_IN_CONVERSATION') {
    const { payload } = action;
    const { searchConversationId, searchConversationName } = payload;

    if (searchConversationId === state.searchConversationId) {
      return {
        ...state,
        startSearchCounter: state.startSearchCounter + 1,
      };
    }

    return {
      ...getEmptyState(),
      searchConversationId,
      searchConversationName,
      startSearchCounter: state.startSearchCounter + 1,
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

  if (action.type === 'SEARCH_MESSAGES_RESULTS_FULFILLED') {
    const { payload } = action;
    const { messages, normalizedPhoneNumber, query } = payload;

    // Reject if the associated query is not the most recent user-provided query
    if (state.query !== query) {
      return state;
    }

    const messageIds = messages.map(message => message.id);

    return {
      ...state,
      normalizedPhoneNumber,
      query,
      messageIds,
      messageLookup: makeLookup(messages, 'id'),
      messagesLoading: false,
    };
  }

  if (action.type === 'SEARCH_DISCUSSIONS_RESULTS_FULFILLED') {
    const { payload } = action;
    const { contacts, conversations } = payload;

    return {
      ...state,
      contacts,
      conversations,
      discussionsLoading: false,
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

  if (action.type === 'CONVERSATION_UNLOADED') {
    const { payload } = action;
    const { id } = payload;
    const { searchConversationId } = state;

    if (searchConversationId && searchConversationId === id) {
      return getEmptyState();
    }

    return state;
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
