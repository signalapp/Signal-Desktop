import { omit, reject } from 'lodash';

import { normalize } from '../../types/PhoneNumber';
import { SearchOptions } from '../../types/Search';
import { trigger } from '../../shims/events';
import { getMessageModel } from '../../shims/Whisper';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import {
  getPrimaryDeviceFor,
  searchConversations,
  searchMessages,
} from '../../../js/modules/data';
import { makeLookup } from '../../util/makeLookup';

import {
  ConversationType,
  MessageExpiredActionType,
  MessageType,
  RemoveAllConversationsActionType,
  SelectedConversationChangedActionType,
} from './conversations';

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
  startNewConversation,
};

function search(
  query: string,
  options: SearchOptions
): SearchResultsKickoffActionType {
  return {
    type: 'SEARCH_RESULTS',
    payload: doSearch(query, options),
  };
}

async function doSearch(
  query: string,
  options: SearchOptions
): Promise<SearchResultsPayloadType> {
  const { regionCode } = options;

  const [discussions, messages] = await Promise.all([
    queryConversationsAndContacts(query, options),
    queryMessages(query),
  ]);
  const { conversations, contacts } = discussions;
  const filteredMessages = messages.filter(message => message !== undefined);

  return {
    query,
    normalizedPhoneNumber: normalize(query, { regionCode }),
    conversations,
    contacts,
    messages: getMessageProps(filteredMessages) || [],
  };
}
function clearSearch(): ClearSearchActionType {
  return {
    type: 'SEARCH_CLEAR',
    payload: null,
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

// Helper functions for search

const getMessageProps = (messages: Array<MessageType>) => {
  if (!messages || !messages.length) {
    return [];
  }

  return messages.map(message => {
    const model = getMessageModel(message);

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

async function queryConversationsAndContacts(
  providedQuery: string,
  options: SearchOptions
) {
  const { ourNumber, noteToSelf, isSecondaryDevice } = options;
  const query = providedQuery.replace(/[+-.()]*/g, '');

  const searchResults: Array<ConversationType> = await searchConversations(
    query
  );

  const ourPrimaryDevice = isSecondaryDevice
    ? await getPrimaryDeviceFor(ourNumber)
    : ourNumber;

  const resultPrimaryDevices: Array<string | null> = await Promise.all(
    searchResults.map(
      async conversation =>
        conversation.id === ourPrimaryDevice
          ? Promise.resolve(ourPrimaryDevice)
          : getPrimaryDeviceFor(conversation.id)
    )
  );

  // Split into two groups - active conversations and items just from address book
  let conversations: Array<string> = [];
  let contacts: Array<string> = [];
  const max = searchResults.length;
  for (let i = 0; i < max; i += 1) {
    const conversation = searchResults[i];
    const primaryDevice = resultPrimaryDevices[i];

    if (primaryDevice) {
      if (isSecondaryDevice && primaryDevice === ourPrimaryDevice) {
        conversations.push(ourNumber);
      } else {
        conversations.push(primaryDevice);
      }
    } else if (conversation.type === 'direct') {
      contacts.push(conversation.id);
    } else if (conversation.type !== 'group') {
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

export function reducer(
  state: SearchStateType | undefined,
  action: SEARCH_TYPES
): SearchStateType {
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
    const {
      query,
      messages,
      normalizedPhoneNumber,
      conversations,
      contacts,
    } = payload;

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
    const { id } = payload;

    return {
      ...state,
      messages: reject(messages, message => id === message.id),
      messageLookup: omit(messageLookup, ['id']),
    };
  }

  return state;
}
