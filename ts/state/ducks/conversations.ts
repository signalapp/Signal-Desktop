import _, { omit } from 'lodash';

import { Constants } from '../../session';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { MessageModel } from '../../../js/models/messages';
import { ConversationController } from '../../session/conversations';

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

export type MessageTypeInConvo = {
  id: string;
  conversationId: string;
  attributes: any;
  propsForMessage: Object;
  propsForSearchResult: Object;
  propsForGroupInvitation: Object;
  propsForTimerNotification: Object;
  propsForGroupNotification: Object;
  firstMessageOfSeries: boolean;
  receivedAt: number;
  getPropsForMessageDetail(): Promise<any>;
};

export type ConversationType = {
  id: string;
  name?: string;
  activeAt?: number;
  timestamp: number;
  lastMessage?: {
    status: 'error' | 'sending' | 'sent' | 'delivered' | 'read';
    text: string;
  };
  phoneNumber: string;
  type: 'direct' | 'group';
  isMe: boolean;
  isPublic?: boolean;
  lastUpdated: number;
  unreadCount: number;
  mentionedUs: boolean;
  isSelected: boolean;
  isTyping: boolean;
  isBlocked: boolean;
  isKickedFromGroup: boolean;
  left: boolean;
  avatarPath?: string; // absolute filepath to the avatar
  groupAdmins?: Array<string>; // admins for closed groups and moderators for open groups
  members?: Array<string>; // members for closed groups only
};
export type ConversationLookupType = {
  [key: string]: ConversationType;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  selectedConversation?: string;
  messages: Array<MessageTypeInConvo>;
};

async function getMessages(
  conversationKey: string,
  numMessages: number
): Promise<Array<MessageTypeInConvo>> {
  const conversation = ConversationController.getInstance().get(
    conversationKey
  );
  if (!conversation) {
    // no valid conversation, early return
    window.log.error('Failed to get convo on reducer.');
    return [];
  }
  const unreadCount = await conversation.getUnreadCount();
  let msgCount =
    numMessages ||
    Number(Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT) + unreadCount;
  msgCount =
    msgCount > Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
      ? Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
      : msgCount;

  if (msgCount < Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT) {
    msgCount = Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
  }

  const messageSet = await window.Signal.Data.getMessagesByConversation(
    conversationKey,
    { limit: msgCount, MessageCollection: window.Whisper.MessageCollection }
  );

  // Set first member of series here.
  const messageModels = messageSet.models;

  const isPublic = conversation.isPublic();

  const sortedMessage = sortMessages(messageModels, isPublic);

  // no need to do that `firstMessageOfSeries` on a private chat
  if (conversation.isPrivate()) {
    return sortedMessage;
  }
  return updateFirstMessageOfSeries(sortedMessage);
}

const updateFirstMessageOfSeries = (messageModels: Array<any>) => {
  // messages are got from the more recent to the oldest, so we need to check if
  // the next messages in the list is still the same author.
  // The message is the first of the series if the next message is not from the same author
  for (let i = 0; i < messageModels.length; i++) {
    // Handle firstMessageOfSeries for conditional avatar rendering
    let firstMessageOfSeries = true;
    const currentSender = messageModels[i].propsForMessage?.authorPhoneNumber;
    const nextSender =
      i < messageModels.length - 1
        ? messageModels[i + 1].propsForMessage?.authorPhoneNumber
        : undefined;
    if (i >= 0 && currentSender === nextSender) {
      firstMessageOfSeries = false;
    }
    messageModels[i].firstMessageOfSeries = firstMessageOfSeries;
  }
  return messageModels;
};

const fetchMessagesForConversation = createAsyncThunk(
  'messages/fetchByConversationKey',
  async ({
    conversationKey,
    count,
  }: {
    conversationKey: string;
    count: number;
  }) => {
    const beforeTimestamp = Date.now();
    const messages = await getMessages(conversationKey, count);
    const afterTimestamp = Date.now();

    const time = afterTimestamp - beforeTimestamp;
    window.log.info(
      `Loading ${messages.length} messages took ${time}ms to load.`
    );

    return {
      conversationKey,
      messages,
    };
  }
);

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
    messageId: string;
    conversationKey: string;
  };
};
export type MessageChangedActionType = {
  type: 'MESSAGE_CHANGED';
  payload: MessageModel;
};
export type MessageAddedActionType = {
  type: 'MESSAGE_ADDED';
  payload: {
    conversationKey: string;
    messageModel: MessageModel;
  };
};
export type MessageDeletedActionType = {
  type: 'MESSAGE_DELETED';
  payload: {
    conversationKey: string;
    messageId: string;
  };
};
export type ConversationResetActionType = {
  type: 'CONVERSATION_RESET';
  payload: {
    conversationKey: string;
  };
};
export type SelectedConversationChangedActionType = {
  type: 'SELECTED_CONVERSATION_CHANGED';
  payload: {
    id: string;
    messageId?: string;
  };
};

export type FetchMessagesForConversationType = {
  type: 'messages/fetchByConversationKey/fulfilled';
  payload: {
    conversationKey: string;
    messages: Array<MessageModel>;
  };
};

export type ConversationActionType =
  | ConversationAddedActionType
  | ConversationChangedActionType
  | ConversationRemovedActionType
  | ConversationResetActionType
  | RemoveAllConversationsActionType
  | MessageExpiredActionType
  | MessageAddedActionType
  | MessageDeletedActionType
  | MessageChangedActionType
  | SelectedConversationChangedActionType
  | SelectedConversationChangedActionType
  | FetchMessagesForConversationType;

// Action Creators

export const actions = {
  conversationAdded,
  conversationChanged,
  conversationRemoved,
  removeAllConversations,
  messageExpired,
  messageAdded,
  messageDeleted,
  conversationReset,
  messageChanged,
  fetchMessagesForConversation,
  openConversationExternal,
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

function messageExpired({
  conversationKey,
  messageId,
}: {
  conversationKey: string;
  messageId: string;
}): MessageExpiredActionType {
  return {
    type: 'MESSAGE_EXPIRED',
    payload: {
      conversationKey,
      messageId,
    },
  };
}

function messageChanged(messageModel: MessageModel): MessageChangedActionType {
  return {
    type: 'MESSAGE_CHANGED',
    payload: messageModel,
  };
}

function messageAdded({
  conversationKey,
  messageModel,
}: {
  conversationKey: string;
  messageModel: MessageModel;
}): MessageAddedActionType {
  return {
    type: 'MESSAGE_ADDED',
    payload: {
      conversationKey,
      messageModel,
    },
  };
}

function messageDeleted({
  conversationKey,
  messageId,
}: {
  conversationKey: string;
  messageId: string;
}): MessageDeletedActionType {
  return {
    type: 'MESSAGE_DELETED',
    payload: {
      conversationKey,
      messageId,
    },
  };
}

function conversationReset({
  conversationKey,
}: {
  conversationKey: string;
}): ConversationResetActionType {
  return {
    type: 'CONVERSATION_RESET',
    payload: {
      conversationKey,
    },
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

// Reducer

const toPickFromMessageModel = [
  'attributes',
  'id',
  'propsForSearchResult',
  'propsForMessage',
  'receivedAt',
  'conversationId',
  'firstMessageOfSeries',
  'propsForGroupInvitation',
  'propsForTimerNotification',
  'propsForVerificationNotification',
  'propsForGroupNotification',
  // FIXME below are what is needed to fetch on the fly messageDetails. This is not the react way
  'getPropsForMessageDetail',
  'get',
  'getConversation',
  'isIncoming',
  'findAndFormatContact',
  'findContact',
  'isUnidentifiedDelivery',
  'getStatus',
  'getMessagePropStatus',
  'hasErrors',
  'isOutgoing',
];

function getEmptyState(): ConversationsStateType {
  return {
    conversationLookup: {},
    messages: [],
  };
}

function sortMessages(
  messages: Array<MessageTypeInConvo>,
  isPublic: boolean
): Array<MessageTypeInConvo> {
  // we order by serverTimestamp for public convos
  if (isPublic) {
    return messages.sort(
      (a: any, b: any) =>
        b.attributes.serverTimestamp - a.attributes.serverTimestamp
    );
  }
  return messages.sort(
    (a: any, b: any) => b.attributes.timestamp - a.attributes.timestamp
  );
}

function handleMessageAdded(
  state: ConversationsStateType,
  action: MessageAddedActionType
) {
  const { messages } = state;
  const { conversationKey, messageModel } = action.payload;
  if (conversationKey === state.selectedConversation) {
    const addedMessage = _.pick(
      messageModel as any,
      toPickFromMessageModel
    ) as MessageTypeInConvo;
    const messagesWithNewMessage = [...messages, addedMessage];
    const convo = state.conversationLookup[state.selectedConversation];
    const isPublic = convo?.isPublic || false;

    if (convo) {
      const sortedMessage = sortMessages(messagesWithNewMessage, isPublic);
      const updatedWithFirstMessageOfSeries = updateFirstMessageOfSeries(
        sortedMessage
      );

      return {
        ...state,
        messages: updatedWithFirstMessageOfSeries,
      };
    }
  }
  return state;
}

function handleMessageChanged(
  state: ConversationsStateType,
  action: MessageChangedActionType
) {
  const messageInStoreIndex = state?.messages?.findIndex(
    m => m.id === action.payload.id
  );
  if (messageInStoreIndex >= 0) {
    const changedMessage = _.pick(
      action.payload as any,
      toPickFromMessageModel
    ) as MessageTypeInConvo;
    // we cannot edit the array directly, so slice the first part, insert our edited message, and slice the second part
    const editedMessages = [
      ...state.messages.slice(0, messageInStoreIndex),
      changedMessage,
      ...state.messages.slice(messageInStoreIndex + 1),
    ];

    // reorder the messages depending on the timestamp (we might have an updated serverTimestamp now)
    const updatedWithFirstMessageOfSeries = updateFirstMessageOfSeries(
      editedMessages
    );

    return {
      ...state,
      messages: updatedWithFirstMessageOfSeries,
    };
  }

  return state;
}

function handleMessageExpiredOrDeleted(
  state: ConversationsStateType,
  action: MessageDeletedActionType | MessageExpiredActionType
) {
  const { conversationKey, messageId } = action.payload;
  if (conversationKey === state.selectedConversation) {
    // search if we find this message id.
    // we might have not loaded yet, so this case might not happen
    const messageInStoreIndex = state?.messages.findIndex(
      m => m.id === messageId
    );
    if (messageInStoreIndex >= 0) {
      // we cannot edit the array directly, so slice the first part, and slice the second part,
      // keeping the index removed out
      const editedMessages = [
        ...state.messages.slice(0, messageInStoreIndex),
        ...state.messages.slice(messageInStoreIndex + 1),
      ];

      const updatedWithFirstMessageOfSeries = updateFirstMessageOfSeries(
        editedMessages
      );

      // FIXME two other thing we have to do:
      // * update the last message text if the message deleted was the last one
      // * update the unread count of the convo if the message was the one counted as an unread

      return {
        ...state,
        messages: updatedWithFirstMessageOfSeries,
      };
    }

    return state;
  }
  return state;
}

function handleConversationReset(
  state: ConversationsStateType,
  action: ConversationResetActionType
) {
  const { conversationKey } = action.payload;
  if (conversationKey === state.selectedConversation) {
    // just empty the list of messages
    return {
      ...state,
      messages: [],
    };
  }
  return state;
}

// tslint:disable: cyclomatic-complexity
// tslint:disable: max-func-body-length
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
    const { conversationLookup, selectedConversation } = state;

    const existing = conversationLookup[id];
    // In the change case we only modify the lookup if we already had that conversation
    if (!existing) {
      return state;
    }

    if (selectedConversation === id) {
      // Inbox -> Archived: no conversation is selected
      // Note: With today's stacked converastions architecture, this can result in weird
      //   behavior - no selected conversation in the left pane, but a conversation show
      //   in the right pane.
      // if (!existing.isArchived && data.isArchived) {
      //   selectedConversation = undefined;
      // }
    }
    return {
      ...state,
      selectedConversation,
      conversationLookup: {
        ...conversationLookup,
        [id]: data,
      },
    };
  }
  if (action.type === 'CONVERSATION_REMOVED') {
    const { payload } = action;
    const { id } = payload;
    const { conversationLookup, selectedConversation } = state;
    return {
      ...state,
      conversationLookup: omit(conversationLookup, [id]),
      selectedConversation:
        selectedConversation === id ? undefined : selectedConversation,
    };
  }
  if (action.type === 'CONVERSATIONS_REMOVE_ALL') {
    return getEmptyState();
  }

  if (action.type === 'SELECTED_CONVERSATION_CHANGED') {
    const { payload } = action;
    const { id } = payload;
    const oldSelectedConversation = state.selectedConversation;
    const newSelectedConversation = id;

    if (newSelectedConversation !== oldSelectedConversation) {
      // empty the message list
      return {
        ...state,
        messages: [],
        selectedConversation: id,
      };
    }
    return {
      ...state,
      selectedConversation: id,
    };
  }

  // this is called once the messages are loaded from the db for the currently selected conversation
  if (action.type === fetchMessagesForConversation.fulfilled.type) {
    const { messages, conversationKey } = action.payload as any;
    // double check that this update is for the shown convo
    if (conversationKey === state.selectedConversation) {
      const lightMessages = messages.map((m: any) =>
        _.pick(m, toPickFromMessageModel)
      ) as Array<MessageTypeInConvo>;
      return {
        ...state,
        messages: lightMessages,
      };
    }
    return state;
  }

  if (action.type === 'MESSAGE_CHANGED') {
    return handleMessageChanged(state, action);
  }

  if (action.type === 'MESSAGE_ADDED') {
    return handleMessageAdded(state, action);
  }
  if (action.type === 'MESSAGE_EXPIRED' || action.type === 'MESSAGE_DELETED') {
    return handleMessageExpiredOrDeleted(state, action);
  }

  if (action.type === 'CONVERSATION_RESET') {
    return handleConversationReset(state, action);
  }

  return state;
}
