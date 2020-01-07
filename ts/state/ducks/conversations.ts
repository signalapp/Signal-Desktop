import {
  difference,
  fromPairs,
  intersection,
  omit,
  orderBy,
  pick,
  uniq,
  values,
  without,
} from 'lodash';
import { trigger } from '../../shims/events';
import { NoopActionType } from './noop';
import { AttachmentType } from '../../types/Attachment';

// State

export type ConversationType = {
  id: string;
  name?: string;
  isArchived: boolean;
  activeAt?: number;
  timestamp: number;
  lastMessage?: {
    status: 'error' | 'sending' | 'sent' | 'delivered' | 'read';
    text: string;
  };
  phoneNumber: string;
  type: 'direct' | 'group';
  isMe: boolean;
  lastUpdated: number;
  unreadCount: number;
  isSelected: boolean;
  typingContact?: {
    avatarPath?: string;
    color: string;
    name?: string;
    phoneNumber: string;
    profileName?: string;
  };

  shouldShowDraft?: boolean;
  draftText?: string;
  draftPreview?: string;
};
export type ConversationLookupType = {
  [key: string]: ConversationType;
};
export type MessageType = {
  id: string;
  conversationId: string;
  source: string;
  type: 'incoming' | 'outgoing' | 'group' | 'keychange' | 'verified-change';
  quote?: { author: string };
  received_at: number;
  hasSignalAccount?: boolean;
  bodyPending?: boolean;
  attachments: Array<AttachmentType>;
  sticker: {
    data?: {
      pending: boolean;
    };
  };

  // No need to go beyond this; unused at this stage, since this goes into
  //   a reducer still in plain JavaScript and comes out well-formed
};

type MessagePointerType = {
  id: string;
  received_at: number;
};
type MessageMetricsType = {
  newest?: MessagePointerType;
  oldest?: MessagePointerType;
  oldestUnread?: MessagePointerType;
  totalUnread: number;
};

export type MessageLookupType = {
  [key: string]: MessageType;
};
export type ConversationMessageType = {
  heightChangeMessageIds: Array<string>;
  isLoadingMessages: boolean;
  isNearBottom?: boolean;
  loadCountdownStart?: number;
  messageIds: Array<string>;
  metrics: MessageMetricsType;
  resetCounter: number;
  scrollToMessageId?: string;
  scrollToMessageCounter: number;
};

export type MessagesByConversationType = {
  [key: string]: ConversationMessageType | null;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  selectedConversation?: string;
  selectedMessage?: string;
  selectedMessageCounter: number;
  showArchived: boolean;

  // Note: it's very important that both of these locations are always kept up to date
  messagesLookup: MessageLookupType;
  messagesByConversation: MessagesByConversationType;
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
export type ConversationUnloadedActionType = {
  type: 'CONVERSATION_UNLOADED';
  payload: {
    id: string;
  };
};
export type RemoveAllConversationsActionType = {
  type: 'CONVERSATIONS_REMOVE_ALL';
  payload: null;
};
export type MessageSelectedActionType = {
  type: 'MESSAGE_SELECTED';
  payload: {
    messageId: string;
    conversationId: string;
  };
};
export type MessageChangedActionType = {
  type: 'MESSAGE_CHANGED';
  payload: {
    id: string;
    conversationId: string;
    data: MessageType;
  };
};
export type MessageDeletedActionType = {
  type: 'MESSAGE_DELETED';
  payload: {
    id: string;
    conversationId: string;
  };
};
export type MessagesAddedActionType = {
  type: 'MESSAGES_ADDED';
  payload: {
    conversationId: string;
    messages: Array<MessageType>;
    isNewMessage: boolean;
    isActive: boolean;
  };
};
export type MessagesResetActionType = {
  type: 'MESSAGES_RESET';
  payload: {
    conversationId: string;
    messages: Array<MessageType>;
    metrics: MessageMetricsType;
    scrollToMessageId?: string;
  };
};
export type SetMessagesLoadingActionType = {
  type: 'SET_MESSAGES_LOADING';
  payload: {
    conversationId: string;
    isLoadingMessages: boolean;
  };
};
export type SetLoadCountdownStartActionType = {
  type: 'SET_LOAD_COUNTDOWN_START';
  payload: {
    conversationId: string;
    loadCountdownStart?: number;
  };
};
export type SetIsNearBottomActionType = {
  type: 'SET_NEAR_BOTTOM';
  payload: {
    conversationId: string;
    isNearBottom: boolean;
  };
};
export type ScrollToMessageActionType = {
  type: 'SCROLL_TO_MESSAGE';
  payload: {
    conversationId: string;
    messageId: string;
  };
};
export type ClearChangedMessagesActionType = {
  type: 'CLEAR_CHANGED_MESSAGES';
  payload: {
    conversationId: string;
  };
};
export type ClearSelectedMessageActionType = {
  type: 'CLEAR_SELECTED_MESSAGE';
  payload: null;
};
export type ClearUnreadMetricsActionType = {
  type: 'CLEAR_UNREAD_METRICS';
  payload: {
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
export type ShowArchivedConversationsActionType = {
  type: 'SHOW_ARCHIVED_CONVERSATIONS';
  payload: null;
};

export type ConversationActionType =
  | ConversationAddedActionType
  | ConversationChangedActionType
  | ConversationRemovedActionType
  | ConversationUnloadedActionType
  | RemoveAllConversationsActionType
  | MessageSelectedActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessagesAddedActionType
  | MessagesResetActionType
  | SetMessagesLoadingActionType
  | SetIsNearBottomActionType
  | SetLoadCountdownStartActionType
  | ClearChangedMessagesActionType
  | ClearSelectedMessageActionType
  | ClearUnreadMetricsActionType
  | ScrollToMessageActionType
  | SelectedConversationChangedActionType
  | MessageDeletedActionType
  | SelectedConversationChangedActionType
  | ShowInboxActionType
  | ShowArchivedConversationsActionType;

// Action Creators

export const actions = {
  conversationAdded,
  conversationChanged,
  conversationRemoved,
  conversationUnloaded,
  removeAllConversations,
  selectMessage,
  messageDeleted,
  messageChanged,
  messagesAdded,
  messagesReset,
  setMessagesLoading,
  setLoadCountdownStart,
  setIsNearBottom,
  clearChangedMessages,
  clearSelectedMessage,
  clearUnreadMetrics,
  scrollToMessage,
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
function conversationUnloaded(id: string): ConversationUnloadedActionType {
  return {
    type: 'CONVERSATION_UNLOADED',
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

function selectMessage(messageId: string, conversationId: string) {
  return {
    type: 'MESSAGE_SELECTED',
    payload: {
      messageId,
      conversationId,
    },
  };
}

function messageChanged(
  id: string,
  conversationId: string,
  data: MessageType
): MessageChangedActionType {
  return {
    type: 'MESSAGE_CHANGED',
    payload: {
      id,
      conversationId,
      data,
    },
  };
}
function messageDeleted(
  id: string,
  conversationId: string
): MessageDeletedActionType {
  return {
    type: 'MESSAGE_DELETED',
    payload: {
      id,
      conversationId,
    },
  };
}
function messagesAdded(
  conversationId: string,
  messages: Array<MessageType>,
  isNewMessage: boolean,
  isActive: boolean
): MessagesAddedActionType {
  return {
    type: 'MESSAGES_ADDED',
    payload: {
      conversationId,
      messages,
      isNewMessage,
      isActive,
    },
  };
}
function messagesReset(
  conversationId: string,
  messages: Array<MessageType>,
  metrics: MessageMetricsType,
  scrollToMessageId?: string
): MessagesResetActionType {
  return {
    type: 'MESSAGES_RESET',
    payload: {
      conversationId,
      messages,
      metrics,
      scrollToMessageId,
    },
  };
}
function setMessagesLoading(
  conversationId: string,
  isLoadingMessages: boolean
): SetMessagesLoadingActionType {
  return {
    type: 'SET_MESSAGES_LOADING',
    payload: {
      conversationId,
      isLoadingMessages,
    },
  };
}
function setLoadCountdownStart(
  conversationId: string,
  loadCountdownStart?: number
): SetLoadCountdownStartActionType {
  return {
    type: 'SET_LOAD_COUNTDOWN_START',
    payload: {
      conversationId,
      loadCountdownStart,
    },
  };
}
function setIsNearBottom(
  conversationId: string,
  isNearBottom: boolean
): SetIsNearBottomActionType {
  return {
    type: 'SET_NEAR_BOTTOM',
    payload: {
      conversationId,
      isNearBottom,
    },
  };
}
function clearChangedMessages(
  conversationId: string
): ClearChangedMessagesActionType {
  return {
    type: 'CLEAR_CHANGED_MESSAGES',
    payload: {
      conversationId,
    },
  };
}
function clearSelectedMessage(): ClearSelectedMessageActionType {
  return {
    type: 'CLEAR_SELECTED_MESSAGE',
    payload: null,
  };
}
function clearUnreadMetrics(
  conversationId: string
): ClearUnreadMetricsActionType {
  return {
    type: 'CLEAR_UNREAD_METRICS',
    payload: {
      conversationId,
    },
  };
}

function scrollToMessage(
  conversationId: string,
  messageId: string
): ScrollToMessageActionType {
  return {
    type: 'SCROLL_TO_MESSAGE',
    payload: {
      conversationId,
      messageId,
    },
  };
}

// Note: we need two actions here to simplify. Operations outside of the left pane can
//   trigger an 'openConversation' so we go through Whisper.events for all
//   conversation selection. Internal just triggers the Whisper.event, and External
//   makes the changes to the store.
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
    messagesByConversation: {},
    messagesLookup: {},
    selectedMessageCounter: 0,
    showArchived: false,
  };
}

function hasMessageHeightChanged(
  message: MessageType,
  previous: MessageType
): Boolean {
  const messageAttachments = message.attachments || [];
  const previousAttachments = previous.attachments || [];

  const stickerPendingChanged =
    message.sticker &&
    message.sticker.data &&
    previous.sticker &&
    previous.sticker.data &&
    previous.sticker.data.pending !== message.sticker.data.pending;
  if (stickerPendingChanged) {
    return true;
  }

  const longMessageAttachmentLoaded =
    previous.bodyPending && !message.bodyPending;
  if (longMessageAttachmentLoaded) {
    return true;
  }

  const firstAttachmentNoLongerPending =
    previousAttachments[0] &&
    previousAttachments[0].pending &&
    messageAttachments[0] &&
    !messageAttachments[0].pending;
  if (firstAttachmentNoLongerPending) {
    return true;
  }

  const signalAccountChanged =
    Boolean(message.hasSignalAccount || previous.hasSignalAccount) &&
    message.hasSignalAccount !== previous.hasSignalAccount;
  if (signalAccountChanged) {
    return true;
  }

  return false;
}

// tslint:disable-next-line cyclomatic-complexity max-func-body-length
export function reducer(
  state: ConversationsStateType = getEmptyState(),
  action: ConversationActionType
): ConversationsStateType {
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
  if (action.type === 'CONVERSATION_UNLOADED') {
    const { payload } = action;
    const { id } = payload;
    const existingConversation = state.messagesByConversation[id];
    if (!existingConversation) {
      return state;
    }

    const { messageIds } = existingConversation;
    const selectedConversation =
      state.selectedConversation !== id
        ? state.selectedConversation
        : undefined;

    return {
      ...state,
      selectedConversation,
      messagesLookup: omit(state.messagesLookup, messageIds),
      messagesByConversation: omit(state.messagesByConversation, [id]),
    };
  }
  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }
  if (action.type === 'MESSAGE_SELECTED') {
    const { messageId, conversationId } = action.payload;

    if (state.selectedConversation !== conversationId) {
      return state;
    }

    return {
      ...state,
      selectedMessage: messageId,
      selectedMessageCounter: state.selectedMessageCounter + 1,
    };
  }
  if (action.type === 'MESSAGE_CHANGED') {
    const { id, conversationId, data } = action.payload;
    const existingConversation = state.messagesByConversation[conversationId];

    // We don't keep track of messages unless their conversation is loaded...
    if (!existingConversation) {
      return state;
    }
    // ...and we've already loaded that message once
    const existingMessage = state.messagesLookup[id];
    if (!existingMessage) {
      return state;
    }

    // Check for changes which could affect height - that's why we need this
    //   heightChangeMessageIds field. It tells Timeline to recalculate all of its heights
    const hasHeightChanged = hasMessageHeightChanged(data, existingMessage);

    const { heightChangeMessageIds } = existingConversation;
    const updatedChanges = hasHeightChanged
      ? uniq([...heightChangeMessageIds, id])
      : heightChangeMessageIds;

    return {
      ...state,
      messagesLookup: {
        ...state.messagesLookup,
        [id]: data,
      },
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          heightChangeMessageIds: updatedChanges,
        },
      },
    };
  }
  if (action.type === 'MESSAGES_RESET') {
    const {
      conversationId,
      messages,
      metrics,
      scrollToMessageId,
    } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = messagesByConversation[conversationId];
    const resetCounter = existingConversation
      ? existingConversation.resetCounter + 1
      : 0;

    const sorted = orderBy(messages, ['received_at'], ['ASC']);
    const messageIds = sorted.map(message => message.id);

    const lookup = fromPairs(messages.map(message => [message.id, message]));

    return {
      ...state,
      selectedMessage: scrollToMessageId,
      selectedMessageCounter: state.selectedMessageCounter + 1,
      messagesLookup: {
        ...messagesLookup,
        ...lookup,
      },
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          isLoadingMessages: false,
          scrollToMessageId,
          scrollToMessageCounter: existingConversation
            ? existingConversation.scrollToMessageCounter + 1
            : 0,
          messageIds,
          metrics,
          resetCounter,
          heightChangeMessageIds: [],
        },
      },
    };
  }
  if (action.type === 'SET_MESSAGES_LOADING') {
    const { payload } = action;
    const { conversationId, isLoadingMessages } = payload;

    const { messagesByConversation } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          loadCountdownStart: undefined,
          isLoadingMessages,
        },
      },
    };
  }
  if (action.type === 'SET_LOAD_COUNTDOWN_START') {
    const { payload } = action;
    const { conversationId, loadCountdownStart } = payload;

    const { messagesByConversation } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          loadCountdownStart,
        },
      },
    };
  }
  if (action.type === 'SET_NEAR_BOTTOM') {
    const { payload } = action;
    const { conversationId, isNearBottom } = payload;

    const { messagesByConversation } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          isNearBottom,
        },
      },
    };
  }
  if (action.type === 'SCROLL_TO_MESSAGE') {
    const { payload } = action;
    const { conversationId, messageId } = payload;

    const { messagesByConversation, messagesLookup } = state;
    const existingConversation = messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }
    if (!messagesLookup[messageId]) {
      return state;
    }
    if (!existingConversation.messageIds.includes(messageId)) {
      return state;
    }

    return {
      ...state,
      selectedMessage: messageId,
      selectedMessageCounter: state.selectedMessageCounter + 1,
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          isLoadingMessages: false,
          scrollToMessageId: messageId,
          scrollToMessageCounter:
            existingConversation.scrollToMessageCounter + 1,
        },
      },
    };
  }
  if (action.type === 'MESSAGE_DELETED') {
    const { id, conversationId } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = messagesByConversation[conversationId];
    if (!existingConversation) {
      return state;
    }

    // Assuming that we always have contiguous groups of messages in memory, the removal
    //   of one message at one end of our message set be replaced with the message right
    //   next to it.
    const oldIds = existingConversation.messageIds;
    let { newest, oldest } = existingConversation.metrics;

    if (oldIds.length > 1) {
      const firstId = oldIds[0];
      const lastId = oldIds[oldIds.length - 1];

      if (oldest && oldest.id === firstId && firstId === id) {
        const second = messagesLookup[oldIds[1]];
        oldest = second ? pick(second, ['id', 'received_at']) : undefined;
      }
      if (newest && newest.id === lastId && lastId === id) {
        const penultimate = messagesLookup[oldIds[oldIds.length - 2]];
        newest = penultimate
          ? pick(penultimate, ['id', 'received_at'])
          : undefined;
      }
    }

    // Removing it from our caches
    const messageIds = without(existingConversation.messageIds, id);
    const heightChangeMessageIds = without(
      existingConversation.heightChangeMessageIds,
      id
    );

    return {
      ...state,
      messagesLookup: omit(messagesLookup, id),
      messagesByConversation: {
        [conversationId]: {
          ...existingConversation,
          messageIds,
          heightChangeMessageIds,
          metrics: {
            ...existingConversation.metrics,
            oldest,
            newest,
          },
        },
      },
    };
  }
  if (action.type === 'MESSAGES_ADDED') {
    const { conversationId, isActive, isNewMessage, messages } = action.payload;
    const { messagesByConversation, messagesLookup } = state;

    const existingConversation = messagesByConversation[conversationId];
    if (!existingConversation) {
      return state;
    }

    let {
      newest,
      oldest,
      oldestUnread,
      totalUnread,
    } = existingConversation.metrics;

    if (messages.length < 1) {
      return state;
    }

    const lookup = fromPairs(
      existingConversation.messageIds.map(id => [id, messagesLookup[id]])
    );
    messages.forEach(message => {
      lookup[message.id] = message;
    });

    const sorted = orderBy(values(lookup), ['received_at'], ['ASC']);
    const messageIds = sorted.map(message => message.id);

    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!newest) {
      newest = pick(first, ['id', 'received_at']);
    }
    if (!oldest) {
      oldest = pick(last, ['id', 'received_at']);
    }

    const existingTotal = existingConversation.messageIds.length;
    if (isNewMessage && existingTotal > 0) {
      const lastMessageId = existingConversation.messageIds[existingTotal - 1];

      // If our messages in memory don't include the most recent messages, then we
      //   won't add new messages to our message list.
      const haveLatest = newest && newest.id === lastMessageId;
      if (!haveLatest) {
        return state;
      }
    }

    if (first && oldest && first.received_at < oldest.received_at) {
      oldest = pick(first, ['id', 'received_at']);
    }
    if (last && newest && last.received_at > newest.received_at) {
      newest = pick(last, ['id', 'received_at']);
    }

    const newIds = messages.map(message => message.id);
    const newMessageIds = difference(newIds, existingConversation.messageIds);
    const { isNearBottom } = existingConversation;

    if ((!isNearBottom || !isActive) && !oldestUnread) {
      const oldestId = newMessageIds.find(messageId => {
        const message = lookup[messageId];

        return Boolean(message.unread);
      });

      if (oldestId) {
        oldestUnread = pick(lookup[oldestId], [
          'id',
          'received_at',
        ]) as MessagePointerType;
      }
    }

    if (oldestUnread) {
      const newUnread: number = newMessageIds.reduce((sum, messageId) => {
        const message = lookup[messageId];

        return sum + (message && message.unread ? 1 : 0);
      }, 0);
      totalUnread = (totalUnread || 0) + newUnread;
    }

    const changedIds = intersection(newIds, existingConversation.messageIds);
    const heightChangeMessageIds = uniq([
      ...changedIds,
      ...existingConversation.heightChangeMessageIds,
    ]);

    return {
      ...state,
      messagesLookup: {
        ...messagesLookup,
        ...lookup,
      },
      messagesByConversation: {
        ...messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          isLoadingMessages: false,
          messageIds,
          heightChangeMessageIds,
          scrollToMessageId: undefined,
          metrics: {
            ...existingConversation.metrics,
            newest,
            oldest,
            totalUnread,
            oldestUnread,
          },
        },
      },
    };
  }
  if (action.type === 'CLEAR_SELECTED_MESSAGE') {
    return {
      ...state,
      selectedMessage: undefined,
    };
  }
  if (action.type === 'CLEAR_CHANGED_MESSAGES') {
    const { payload } = action;
    const { conversationId } = payload;
    const existingConversation = state.messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          heightChangeMessageIds: [],
        },
      },
    };
  }
  if (action.type === 'CLEAR_UNREAD_METRICS') {
    const { payload } = action;
    const { conversationId } = payload;
    const existingConversation = state.messagesByConversation[conversationId];

    if (!existingConversation) {
      return state;
    }

    return {
      ...state,
      messagesByConversation: {
        ...state.messagesByConversation,
        [conversationId]: {
          ...existingConversation,
          metrics: {
            ...existingConversation.metrics,
            oldestUnread: undefined,
            totalUnread: 0,
          },
        },
      },
    };
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
