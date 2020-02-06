import { omit } from 'lodash';

import { trigger } from '../../shims/events';
import { NoopActionType } from './noop';

// State

export type MessageType = {
  id: string;
  conversationId: string;
  receivedAt: number;

  snippet: string;

  from: {
    phoneNumber: string;
    isMe?: boolean;
    name?: string;
    color?: string;
    profileName?: string;
    avatarPath?: string;
  };

  to: {
    groupName?: string;
    phoneNumber: string;
    isMe?: boolean;
    name?: string;
    profileName?: string;
  };

  isSelected?: boolean;
};
export type ConversationType = {
  id: string;
  name?: string;
  isArchived: boolean;
  activeAt?: number;
  timestamp: number;
  lastMessage?: {
    status: 'error' | 'sending' | 'sent' | 'delivered' | 'read';
    text: string;
    isRss: boolean;
  };
  phoneNumber: string;
  type: 'direct' | 'group';
  isMe: boolean;
  isPublic?: boolean;
  isClosable?: boolean;
  lastUpdated: number;
  unreadCount: number;
  mentionedUs: boolean;
  isSelected: boolean;
  isTyping: boolean;
  isFriend?: boolean;
  hasReceivedFriendRequest?: boolean;
  hasSentFriendRequest?: boolean;
};
export type ConversationLookupType = {
  [key: string]: ConversationType;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  selectedConversation?: string;
  showArchived: boolean;
};

// Actions

type ConversationAddedActionType = {
  type: 'CONVERSATION_ADDED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationChangedActionType = {
  type: 'CONVERSATION_CHANGED';
  payload: {
    id: string;
    data: ConversationType;
  };
};
type ConversationRemovedActionType = {
  type: 'CONVERSATION_REMOVED';
  payload: {
    id: string;
  };
};
export type RemoveAllConversationsActionType = {
  type: 'CONVERSATIONS_REMOVE_ALL';
  payload: null;
};
export type MessageExpiredActionType = {
  type: 'MESSAGE_EXPIRED';
  payload: {
    id: string;
    conversationId: string;
  };
};
export type SelectedConversationChangedActionType = {
  type: 'SELECTED_CONVERSATION_CHANGED';
  payload: {
    id: string;
    messageId?: string;
  };
};
type ShowInboxActionType = {
  type: 'SHOW_INBOX';
  payload: null;
};
type ShowArchivedConversationsActionType = {
  type: 'SHOW_ARCHIVED_CONVERSATIONS';
  payload: null;
};

export type ConversationActionType =
  | ConversationAddedActionType
  | ConversationChangedActionType
  | ConversationRemovedActionType
  | RemoveAllConversationsActionType
  | MessageExpiredActionType
  | SelectedConversationChangedActionType
  | MessageExpiredActionType
  | SelectedConversationChangedActionType
  | ShowInboxActionType
  | ShowArchivedConversationsActionType;

// Action Creators

export const actions = {
  conversationAdded,
  conversationChanged,
  conversationRemoved,
  removeAllConversations,
  messageExpired,
  openConversationInternal,
  openConversationExternal,
  showInbox,
  showArchivedConversations,
};

function conversationAdded(
  id: string,
  data: ConversationType
): ConversationAddedActionType {
  return {
    type: 'CONVERSATION_ADDED',
    payload: {
      id,
      data,
    },
  };
}
function conversationChanged(
  id: string,
  data: ConversationType
): ConversationChangedActionType {
  return {
    type: 'CONVERSATION_CHANGED',
    payload: {
      id,
      data,
    },
  };
}
function conversationRemoved(id: string): ConversationRemovedActionType {
  return {
    type: 'CONVERSATION_REMOVED',
    payload: {
      id,
    },
  };
}
function removeAllConversations(): RemoveAllConversationsActionType {
  return {
    type: 'CONVERSATIONS_REMOVE_ALL',
    payload: null,
  };
}

function messageExpired(
  id: string,
  conversationId: string
): MessageExpiredActionType {
  return {
    type: 'MESSAGE_EXPIRED',
    payload: {
      id,
      conversationId,
    },
  };
}

// Note: we need two actions here to simplify. Operations outside of the left pane can
//   trigger an 'openConversation' so we go through Whisper.events for all conversation
//   selection.
function openConversationInternal(
  id: string,
  messageId?: string
): NoopActionType {
  trigger('showConversation', id, messageId);

  return {
    type: 'NOOP',
    payload: null,
  };
}
function openConversationExternal(
  id: string,
  messageId?: string
): SelectedConversationChangedActionType {
  return {
    type: 'SELECTED_CONVERSATION_CHANGED',
    payload: {
      id,
      messageId,
    },
  };
}

function showInbox() {
  return {
    type: 'SHOW_INBOX',
    payload: null,
  };
}
function showArchivedConversations() {
  return {
    type: 'SHOW_ARCHIVED_CONVERSATIONS',
    payload: null,
  };
}

// Reducer

function getEmptyState(): ConversationsStateType {
  return {
    conversationLookup: {},
    showArchived: false,
  };
}

export function reducer(
  state: ConversationsStateType,
  action: ConversationActionType
): ConversationsStateType {
  if (!state) {
    return getEmptyState();
  }

  if (action.type === 'CONVERSATION_ADDED') {
    const { payload } = action;
    const { id, data } = payload;
    const { conversationLookup } = state;

    return {
      ...state,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
    };
  }
  if (action.type === 'CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id, data } = payload;
    const { conversationLookup } = state;

    let showArchived = state.showArchived;
    let selectedConversation = state.selectedConversation;

    const existing = conversationLookup[id];
    // In the change case we only modify the lookup if we already had that conversation
    if (!existing) {
      return state;
    }

    if (selectedConversation === id) {
      // Archived -> Inbox: we go back to the normal inbox view
      if (existing.isArchived && !data.isArchived) {
        showArchived = false;
      }
      // Inbox -> Archived: no conversation is selected
      // Note: With today's stacked converastions architecture, this can result in weird
      //   behavior - no selected conversation in the left pane, but a conversation show
      //   in the right pane.
      if (!existing.isArchived && data.isArchived) {
        selectedConversation = undefined;
      }
    }

    return {
      ...state,
      selectedConversation,
      showArchived,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
    };
  }
  if (action.type === 'CONVERSATION_REMOVED') {
    const { payload } = action;
    const { id } = payload;
    const { conversationLookup } = state;

    return {
      ...state,
      conversationLookup: omit(conversationLookup, [id]),
    };
  }
  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }
  if (action.type === 'MESSAGE_EXPIRED') {
    // noop - for now this is only important for search
  }
  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id } = payload;

    return {
      ...state,
      selectedConversation: id,
    };
  }
  if (action.type === 'SHOW_INBOX') {
    return {
      ...state,
      showArchived: false,
    };
  }
  if (action.type === 'SHOW_ARCHIVED_CONVERSATIONS') {
    return {
      ...state,
      showArchived: true,
    };
  }

  return state;
}
