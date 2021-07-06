import _, { omit } from 'lodash';

import { Constants } from '../../session';
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getConversationController } from '../../session/conversations';
import { MessageModel } from '../../models/message';
import { getMessagesByConversation } from '../../data/data';
import { ConversationTypeEnum } from '../../models/conversation';
import {
  MessageDeliveryStatus,
  MessageModelType,
  PropsForDataExtractionNotification,
} from '../../models/messageType';
import { AttachmentType } from '../../types/Attachment';

export type MessageModelProps = {
  propsForMessage: PropsForMessage;
  propsForSearchResult: PropsForSearchResults | null;
  propsForGroupInvitation: PropsForGroupInvitation | null;
  propsForTimerNotification: PropsForExpirationTimer | null;
  propsForDataExtractionNotification: PropsForDataExtractionNotification | null;
  propsForGroupNotification: PropsForGroupUpdate | null;
};

export type MessagePropsDetails = {};

export type LastMessageStatusType = MessageDeliveryStatus | null;

export type FindAndFormatContactType = {
  phoneNumber: string;
  avatarPath: string | null;
  name: string | null;
  profileName: string | null;
  title: string | null;
  isMe: boolean;
};

export type PropsForExpirationTimer = {
  timespan: string;
  disabled: boolean;
  phoneNumber: string;
  avatarPath: string | null;
  name: string | null;
  profileName: string | null;
  title: string | null;
  type: 'fromMe' | 'fromSync' | 'fromOther';
};

export type PropsForGroupUpdateGeneral = {
  type: 'general';
};

export type PropsForGroupUpdateAdd = {
  type: 'add';
  contacts?: Array<FindAndFormatContactType>;
};

export type PropsForGroupUpdateKicked = {
  type: 'kicked';
  isMe: boolean;
  contacts?: Array<FindAndFormatContactType>;
};

export type PropsForGroupUpdateRemove = {
  type: 'remove';
  isMe: boolean;
  contacts?: Array<FindAndFormatContactType>;
};

export type PropsForGroupUpdateName = {
  type: 'name';
  newName: string;
};

export type PropsForGroupUpdateType =
  | PropsForGroupUpdateGeneral
  | PropsForGroupUpdateAdd
  | PropsForGroupUpdateKicked
  | PropsForGroupUpdateName
  | PropsForGroupUpdateRemove;

export type PropsForGroupUpdateArray = Array<PropsForGroupUpdateType>;

export type PropsForGroupUpdate = {
  changes: PropsForGroupUpdateArray;
};

export type PropsForGroupInvitation = {
  serverName: string;
  url: string;
  direction: MessageModelType;
  acceptUrl: string;
  messageId: string;
};

export type PropsForSearchResults = {
  from: FindAndFormatContactType;
  to: FindAndFormatContactType;
  id: string;
  conversationId: string;
  receivedAt: number | undefined;
  snippet?: string; //not sure about the type of snippet
};

export type PropsForAttachment = {
  id?: string;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  path?: string;
  fileSize: string | null;
  isVoiceMessage: boolean;
  pending: boolean;
  fileName: string;
  screenshot: {
    contentType: string;
    width: number;
    height: number;
    url?: string;
    path?: string;
  } | null;
  thumbnail: {
    contentType: string;
    width: number;
    height: number;
    url?: string;
    path?: string;
  } | null;
};

export type PropsForMessage = {
  text: string | null;
  id: string;
  direction: MessageModelType;
  timestamp: number | undefined;
  receivedAt: number | undefined;
  serverTimestamp: number | undefined;
  status: LastMessageStatusType;
  authorName: string | null;
  authorProfileName: string | null;
  authorPhoneNumber: string;
  conversationType: ConversationTypeEnum;
  convoId: string;
  attachments: Array<PropsForAttachment>;
  previews: any;
  quote: any;
  authorAvatarPath: string | null;
  isUnread: boolean;
  expirationLength: number;
  expirationTimestamp: number | null;
  isPublic: boolean;
  isOpenGroupV2: boolean;
  isKickedFromGroup: boolean | undefined;
  isTrustedForAttachmentDownload: boolean;
  weAreAdmin: boolean;
  isSenderAdmin: boolean;
  isDeletable: boolean;
};

export type LastMessageType = {
  status: LastMessageStatusType;
  text: string | null;
};

export interface ConversationType {
  id: string;
  name?: string;
  profileName?: string;
  hasNickname?: boolean;
  index?: number;

  activeAt?: number;
  lastMessage?: LastMessageType;
  phoneNumber: string;
  type: ConversationTypeEnum;
  isMe: boolean;
  isPublic?: boolean;
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
}

export type ConversationLookupType = {
  [key: string]: ConversationType;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  selectedConversation?: string;
  messages: Array<SortedMessageModelProps>;
};

async function getMessages(
  conversationKey: string,
  numMessages: number
): Promise<Array<SortedMessageModelProps>> {
  const conversation = getConversationController().get(conversationKey);
  if (!conversation) {
    // no valid conversation, early return
    window?.log?.error('Failed to get convo on reducer.');
    return [];
  }
  const unreadCount = await conversation.getUnreadCount();
  let msgCount =
    numMessages || Number(Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT) + unreadCount;
  msgCount =
    msgCount > Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
      ? Constants.CONVERSATION.MAX_MESSAGE_FETCH_COUNT
      : msgCount;

  if (msgCount < Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT) {
    msgCount = Constants.CONVERSATION.DEFAULT_MESSAGE_FETCH_COUNT;
  }

  const messageSet = await getMessagesByConversation(conversationKey, {
    limit: msgCount,
  });

  // Set first member of series here.
  const messageModelsProps: Array<SortedMessageModelProps> = [];
  messageSet.models.forEach(m => {
    messageModelsProps.push({ ...m.getProps(), firstMessageOfSeries: true });
  });

  const isPublic = conversation.isPublic();

  const sortedMessageProps = sortMessages(messageModelsProps, isPublic);

  // no need to do that `firstMessageOfSeries` on a private chat
  if (conversation.isPrivate()) {
    return sortedMessageProps;
  }
  return updateFirstMessageOfSeries(sortedMessageProps);
}

export type SortedMessageModelProps = MessageModelProps & {
  firstMessageOfSeries: boolean;
};

const updateFirstMessageOfSeries = (
  messageModelsProps: Array<MessageModelProps>
): Array<SortedMessageModelProps> => {
  // messages are got from the more recent to the oldest, so we need to check if
  // the next messages in the list is still the same author.
  // The message is the first of the series if the next message is not from the same author
  const sortedMessageProps: Array<SortedMessageModelProps> = [];
  for (let i = 0; i < messageModelsProps.length; i++) {
    // Handle firstMessageOfSeries for conditional avatar rendering
    let firstMessageOfSeries = true;
    const currentSender = messageModelsProps[i].propsForMessage?.authorPhoneNumber;
    const nextSender =
      i < messageModelsProps.length - 1
        ? messageModelsProps[i + 1].propsForMessage?.authorPhoneNumber
        : undefined;
    if (i >= 0 && currentSender === nextSender) {
      firstMessageOfSeries = false;
    }

    sortedMessageProps.push({ ...messageModelsProps[i], firstMessageOfSeries });
  }
  return sortedMessageProps;
};

type FetchedMessageResults = {
  conversationKey: string;
  messagesProps: Array<SortedMessageModelProps>;
};

const fetchMessagesForConversation = createAsyncThunk(
  'messages/fetchByConversationKey',
  async ({
    conversationKey,
    count,
  }: {
    conversationKey: string;
    count: number;
  }): Promise<FetchedMessageResults> => {
    const beforeTimestamp = Date.now();
    const messagesProps = await getMessages(conversationKey, count);
    const afterTimestamp = Date.now();

    const time = afterTimestamp - beforeTimestamp;
    window?.log?.info(`Loading ${messagesProps.length} messages took ${time}ms to load.`);

    const mapped = messagesProps.map(m => {
      return {
        ...m,
        firstMessageOfSeries: true,
      };
    });
    return {
      conversationKey,
      messagesProps: mapped,
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
  payload: MessageModelProps;
};
export type MessagesChangedActionType = {
  type: 'MESSAGES_CHANGED';
  payload: Array<MessageModelProps>;
};
export type MessageAddedActionType = {
  type: 'MESSAGE_ADDED';
  payload: {
    conversationKey: string;
    messageModelProps: MessageModelProps;
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
    messages: Array<MessageModelProps>;
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
  | MessagesChangedActionType
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
  messagesChanged,
  fetchMessagesForConversation,
  openConversationExternal,
};

function conversationAdded(id: string, data: ConversationType): ConversationAddedActionType {
  return {
    type: 'CONVERSATION_ADDED',
    payload: {
      id,
      data,
    },
  };
}
function conversationChanged(id: string, data: ConversationType): ConversationChangedActionType {
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

function messageChanged(messageModelProps: MessageModelProps): MessageChangedActionType {
  return {
    type: 'MESSAGE_CHANGED',
    payload: messageModelProps,
  };
}

function messagesChanged(messageModelsProps: Array<MessageModelProps>): MessagesChangedActionType {
  return {
    type: 'MESSAGES_CHANGED',
    payload: messageModelsProps,
  };
}

function messageAdded({
  conversationKey,
  messageModelProps,
}: {
  conversationKey: string;
  messageModelProps: MessageModelProps;
}): MessageAddedActionType {
  return {
    type: 'MESSAGE_ADDED',
    payload: {
      conversationKey,
      messageModelProps,
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

export function conversationReset({
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

export function openConversationExternal(
  id: string,
  messageId?: string
): SelectedConversationChangedActionType {
  window?.log?.info(`openConversationExternal with convoId: ${id}; messageId: ${messageId}`);
  return {
    type: 'SELECTED_CONVERSATION_CHANGED',
    payload: {
      id,
      messageId,
    },
  };
}

// Reducer

function getEmptyState(): ConversationsStateType {
  return {
    conversationLookup: {},
    messages: [],
  };
}

function sortMessages(
  messages: Array<SortedMessageModelProps>,
  isPublic: boolean
): Array<SortedMessageModelProps> {
  // we order by serverTimestamp for public convos
  // be sure to update the sorting order to fetch messages from the DB too at getMessagesByConversation
  if (isPublic) {
    return messages.sort((a, b) => {
      return (b.propsForMessage.serverTimestamp || 0) - (a.propsForMessage.serverTimestamp || 0);
    });
  }
  if (messages.some(n => !n.propsForMessage.timestamp && !n.propsForMessage.receivedAt)) {
    throw new Error('Found some messages without any timestamp set');
  }

  // for non public convos, we order by sent_at or received_at timestamp.
  // we assume that a message has either a sent_at or a received_at field set.
  const messagesSorted = messages.sort(
    (a, b) =>
      (b.propsForMessage.timestamp || b.propsForMessage.receivedAt || 0) -
      (a.propsForMessage.timestamp || a.propsForMessage.receivedAt || 0)
  );

  return messagesSorted;
}

function handleMessageAdded(state: ConversationsStateType, action: MessageAddedActionType) {
  const { messages } = state;
  const { conversationKey, messageModelProps: addedMessageProps } = action.payload;
  if (conversationKey === state.selectedConversation) {
    const messagesWithNewMessage = [
      ...messages,
      { ...addedMessageProps, firstMessageOfSeries: true },
    ];
    const convo = state.conversationLookup[state.selectedConversation];
    const isPublic = convo?.isPublic || false;

    if (convo) {
      const sortedMessage = sortMessages(messagesWithNewMessage, isPublic);
      const updatedWithFirstMessageOfSeries = updateFirstMessageOfSeries(sortedMessage);

      return {
        ...state,
        messages: updatedWithFirstMessageOfSeries,
      };
    }
  }
  return state;
}

function handleMessageChanged(state: ConversationsStateType, action: MessageChangedActionType) {
  const { payload } = action;

  const messageInStoreIndex = state?.messages?.findIndex(
    m => m.propsForMessage.id === payload.propsForMessage.id
  );
  if (messageInStoreIndex >= 0) {
    const changedMessage = { ...payload, firstMessageOfSeries: true };
    // we cannot edit the array directly, so slice the first part, insert our edited message, and slice the second part
    const editedMessages = [
      ...state.messages.slice(0, messageInStoreIndex),
      changedMessage,
      ...state.messages.slice(messageInStoreIndex + 1),
    ];

    const convo = state.conversationLookup[payload.propsForMessage.convoId];
    const isPublic = convo?.isPublic || false;
    // reorder the messages depending on the timestamp (we might have an updated serverTimestamp now)
    const sortedMessage = sortMessages(editedMessages, isPublic);
    const updatedWithFirstMessageOfSeries = updateFirstMessageOfSeries(sortedMessage);

    return {
      ...state,
      messages: updatedWithFirstMessageOfSeries,
    };
  }

  return state;
}

function handleMessagesChanged(state: ConversationsStateType, action: MessagesChangedActionType) {
  const { payload } = action;

  payload.forEach(element => {
    // tslint:disable-next-line: no-parameter-reassignment
    state = handleMessageChanged(state, {
      payload: element,
      type: 'MESSAGE_CHANGED',
    });
  });

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
    const messageInStoreIndex = state?.messages.findIndex(m => m.propsForMessage.id === messageId);
    if (messageInStoreIndex >= 0) {
      // we cannot edit the array directly, so slice the first part, and slice the second part,
      // keeping the index removed out
      const editedMessages = [
        ...state.messages.slice(0, messageInStoreIndex),
        ...state.messages.slice(messageInStoreIndex + 1),
      ];

      const updatedWithFirstMessageOfSeries = updateFirstMessageOfSeries(editedMessages);

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
      selectedConversation: selectedConversation === id ? undefined : selectedConversation,
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
    const { messagesProps, conversationKey } = action.payload as FetchedMessageResults;
    // double check that this update is for the shown convo
    if (conversationKey === state.selectedConversation) {
      return {
        ...state,
        messages: messagesProps,
      };
    }
    return state;
  }

  if (action.type === 'MESSAGE_CHANGED') {
    return handleMessageChanged(state, action);
  }

  if (action.type === 'MESSAGES_CHANGED') {
    return handleMessagesChanged(state, action);
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
