import _, { omit } from 'lodash';

import { Constants } from '../../session';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getConversationController } from '../../session/conversations';
import { getMessagesByConversation } from '../../data/data';
import {
  ConversationNotificationSettingType,
  ConversationTypeEnum,
} from '../../models/conversation';
import {
  MessageDeliveryStatus,
  MessageModelType,
  PropsForDataExtractionNotification,
} from '../../models/messageType';
import { LightBoxOptions } from '../../components/session/conversation/SessionConversation';
import { ReplyingToMessageProps } from '../../components/session/conversation/SessionCompositionBox';
import { QuotedAttachmentType } from '../../components/conversation/Quote';

export type MessageModelProps = {
  propsForMessage: PropsForMessage;
  propsForSearchResult: PropsForSearchResults | null;
  propsForGroupInvitation: PropsForGroupInvitation | null;
  propsForTimerNotification: PropsForExpirationTimer | null;
  propsForDataExtractionNotification: PropsForDataExtractionNotification | null;
  propsForGroupNotification: PropsForGroupUpdate | null;
};

export type ContactPropsMessageDetail = {
  status: string | null;
  phoneNumber: string;
  name?: string | null;
  profileName?: string | null;
  avatarPath?: string | null;
  isOutgoingKeyError: boolean;

  errors?: Array<Error>;
};

export type MessagePropsDetails = {
  sentAt: number;
  receivedAt: number;

  message: PropsForMessage;
  errors: Array<Error>;
  contacts: Array<ContactPropsMessageDetail>;
};

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
  messageId: string;
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
  messageId: string;
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
  id: number;
  contentType: string;
  size: number;
  width?: number;
  height?: number;
  url: string;
  path: string;
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
  timestamp: number;
  receivedAt: number | undefined;
  serverTimestamp: number | undefined;
  serverId: number | undefined;
  status: LastMessageStatusType | null;
  authorName: string | null;
  authorProfileName: string | null;
  authorPhoneNumber: string;
  conversationType: ConversationTypeEnum;
  convoId: string;
  attachments: Array<PropsForAttachment>;
  previews: Array<any>;
  quote?: {
    text: string | null;
    attachment?: QuotedAttachmentType;
    isFromMe: boolean;
    authorPhoneNumber: string;
    authorProfileName?: string;
    authorName?: string;
    messageId?: string;
    referencedMessageNotFound: boolean;
  } | null;
  authorAvatarPath: string | null;
  isUnread: boolean;
  expirationLength: number;
  expirationTimestamp: number | null;
  isPublic: boolean;
  isOpenGroupV2: boolean;
  isKickedFromGroup: boolean;
  isTrustedForAttachmentDownload: boolean;
  weAreAdmin: boolean;
  isSenderAdmin: boolean;
  isDeletable: boolean;
  isExpired: boolean;
  isBlocked: boolean;
};

export type LastMessageType = {
  status: LastMessageStatusType;
  text: string | null;
};

export interface ReduxConversationType {
  id: string;
  name?: string;
  profileName?: string;
  hasNickname: boolean;

  activeAt?: number;
  lastMessage?: LastMessageType;
  phoneNumber: string;
  type: ConversationTypeEnum;
  isMe: boolean;
  isPublic: boolean;
  isGroup: boolean;
  isPrivate: boolean;
  weAreAdmin: boolean;
  unreadCount: number;
  mentionedUs: boolean;
  isSelected: boolean;
  expireTimer: number;

  isTyping: boolean;
  isBlocked: boolean;
  isKickedFromGroup: boolean;
  subscriberCount: number;
  left: boolean;
  avatarPath?: string; // absolute filepath to the avatar
  groupAdmins?: Array<string>; // admins for closed groups and moderators for open groups
  members: Array<string>; // members for closed groups only

  currentNotificationSetting: ConversationNotificationSettingType;
  notificationForConvo: Array<NotificationForConvoOption>;

  isPinned: boolean;
}

export interface NotificationForConvoOption {
  name: string;
  value: ConversationNotificationSettingType;
}

export type ConversationLookupType = {
  [key: string]: ReduxConversationType;
};

export type ConversationsStateType = {
  conversationLookup: ConversationLookupType;
  selectedConversation?: string;
  messages: Array<MessageModelProps>;
  firstUnreadMessageId: string | undefined;
  messageDetailProps?: MessagePropsDetails;
  showRightPanel: boolean;
  selectedMessageIds: Array<string>;
  lightBox?: LightBoxOptions;
  quotedMessage?: ReplyingToMessageProps;
  areMoreMessagesBeingFetched: boolean;

  showScrollButton: boolean;
  animateQuotedMessageId?: string;
  nextMessageToPlay?: number;
  mentionMembers: MentionsMembersType;
};

export type MentionsMembersType = Array<{
  id: string;
  authorPhoneNumber: string;
  authorProfileName: string;
}>;

async function getMessages(
  conversationKey: string,
  numMessagesToFetch: number
): Promise<Array<MessageModelProps>> {
  const conversation = getConversationController().get(conversationKey);
  if (!conversation) {
    // no valid conversation, early return
    window?.log?.error('Failed to get convo on reducer.');
    return [];
  }
  let msgCount = numMessagesToFetch;
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

  const messageProps: Array<MessageModelProps> = messageSet.models.map(m => m.getProps());
  return messageProps;
}

export type SortedMessageModelProps = MessageModelProps & {
  firstMessageOfSeries: boolean;
};

type FetchedMessageResults = {
  conversationKey: string;
  messagesProps: Array<MessageModelProps>;
};

export const fetchMessagesForConversation = createAsyncThunk(
  'messages/fetchByConversationKey',
  async ({
    conversationKey,
    count,
  }: {
    conversationKey: string;
    count: number;
  }): Promise<FetchedMessageResults> => {
    const beforeTimestamp = Date.now();
    // tslint:disable-next-line: no-console
    console.time('fetchMessagesForConversation');
    const messagesProps = await getMessages(conversationKey, count);
    const afterTimestamp = Date.now();
    // tslint:disable-next-line: no-console
    console.timeEnd('fetchMessagesForConversation');

    const time = afterTimestamp - beforeTimestamp;
    window?.log?.info(`Loading ${messagesProps.length} messages took ${time}ms to load.`);

    return {
      conversationKey,
      messagesProps,
    };
  }
);

// Reducer

function getEmptyState(): ConversationsStateType {
  return {
    conversationLookup: {},
    messages: [],
    messageDetailProps: undefined,
    showRightPanel: false,
    selectedMessageIds: [],
    areMoreMessagesBeingFetched: false,
    showScrollButton: false,
    mentionMembers: [],
    firstUnreadMessageId: undefined,
  };
}

function handleMessageAdded(
  state: ConversationsStateType,
  action: PayloadAction<{
    conversationKey: string;
    messageModelProps: MessageModelProps;
  }>
) {
  const { messages } = state;
  const { conversationKey, messageModelProps: addedMessageProps } = action.payload;
  if (conversationKey === state.selectedConversation) {
    const messagesWithNewMessage = [...messages, addedMessageProps];

    return {
      ...state,
      messages: messagesWithNewMessage,
    };
  }
  return state;
}

function handleMessageChanged(state: ConversationsStateType, changedMessage: MessageModelProps) {
  const messageInStoreIndex = state?.messages?.findIndex(
    m => m.propsForMessage.id === changedMessage.propsForMessage.id
  );
  if (messageInStoreIndex >= 0) {
    // we cannot edit the array directly, so slice the first part, insert our edited message, and slice the second part
    const editedMessages = [
      ...state.messages.slice(0, messageInStoreIndex),
      changedMessage,
      ...state.messages.slice(messageInStoreIndex + 1),
    ];

    return {
      ...state,
      messages: editedMessages,
    };
  }

  return state;
}

function handleMessagesChanged(state: ConversationsStateType, payload: Array<MessageModelProps>) {
  payload.forEach(element => {
    // tslint:disable-next-line: no-parameter-reassignment
    state = handleMessageChanged(state, element);
  });

  return state;
}

function handleMessageExpiredOrDeleted(
  state: ConversationsStateType,
  action: PayloadAction<{
    messageId: string;
    conversationKey: string;
  }>
): ConversationsStateType {
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

      // FIXME two other thing we have to do:
      // * update the last message text if the message deleted was the last one
      // * update the unread count of the convo if the message was the one counted as an unread

      return {
        ...state,
        messages: editedMessages,
        firstUnreadMessageId:
          state.firstUnreadMessageId === messageId ? undefined : state.firstUnreadMessageId,
      };
    }

    return state;
  }
  return state;
}

function handleConversationReset(state: ConversationsStateType, action: PayloadAction<string>) {
  const conversationKey = action.payload;
  if (conversationKey === state.selectedConversation) {
    // just empty the list of messages
    return {
      ...state,
      messages: [],
    };
  }
  return state;
}

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState: getEmptyState(),
  reducers: {
    showMessageDetailsView(
      state: ConversationsStateType,
      action: PayloadAction<MessagePropsDetails>
    ) {
      // force the right panel to be hidden when showing message detail view
      return { ...state, messageDetailProps: action.payload, showRightPanel: false };
    },

    closeMessageDetailsView(state: ConversationsStateType) {
      return { ...state, messageDetailProps: undefined };
    },

    openRightPanel(state: ConversationsStateType) {
      return { ...state, showRightPanel: true };
    },
    closeRightPanel(state: ConversationsStateType) {
      return { ...state, showRightPanel: false };
    },
    addMessageIdToSelection(state: ConversationsStateType, action: PayloadAction<string>) {
      if (state.selectedMessageIds.some(id => id === action.payload)) {
        return state;
      }
      return { ...state, selectedMessageIds: [...state.selectedMessageIds, action.payload] };
    },
    removeMessageIdFromSelection(state: ConversationsStateType, action: PayloadAction<string>) {
      const index = state.selectedMessageIds.findIndex(id => id === action.payload);

      if (index === -1) {
        return state;
      }
      return { ...state, selectedMessageIds: state.selectedMessageIds.splice(index, 1) };
    },
    toggleSelectedMessageId(state: ConversationsStateType, action: PayloadAction<string>) {
      const index = state.selectedMessageIds.findIndex(id => id === action.payload);

      if (index === -1) {
        state.selectedMessageIds = [...state.selectedMessageIds, action.payload];
      } else {
        state.selectedMessageIds.splice(index, 1);
      }

      return state;
    },
    resetSelectedMessageIds(state: ConversationsStateType) {
      return { ...state, selectedMessageIds: [] };
    },

    conversationAdded(
      state: ConversationsStateType,
      action: PayloadAction<{
        id: string;
        data: ReduxConversationType;
      }>
    ) {
      const { conversationLookup } = state;

      return {
        ...state,
        conversationLookup: {
          ...conversationLookup,
          [action.payload.id]: action.payload.data,
        },
      };
    },
    conversationChanged(
      state: ConversationsStateType,
      action: PayloadAction<{
        id: string;
        data: ReduxConversationType;
      }>
    ) {
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
    },

    conversationRemoved(state: ConversationsStateType, action: PayloadAction<string>) {
      const { payload: conversationId } = action;
      const { conversationLookup, selectedConversation } = state;
      return {
        ...state,
        conversationLookup: omit(conversationLookup, [conversationId]),
        selectedConversation:
          selectedConversation === conversationId ? undefined : selectedConversation,
      };
    },

    removeAllConversations() {
      return getEmptyState();
    },

    messageAdded(
      state: ConversationsStateType,
      action: PayloadAction<{
        conversationKey: string;
        messageModelProps: MessageModelProps;
      }>
    ) {
      return handleMessageAdded(state, action);
    },

    messageChanged(state: ConversationsStateType, action: PayloadAction<MessageModelProps>) {
      return handleMessageChanged(state, action.payload);
    },
    messagesChanged(
      state: ConversationsStateType,
      action: PayloadAction<Array<MessageModelProps>>
    ) {
      return handleMessagesChanged(state, action.payload);
    },

    messageExpired(
      state: ConversationsStateType,
      action: PayloadAction<{
        messageId: string;
        conversationKey: string;
      }>
    ) {
      return handleMessageExpiredOrDeleted(state, action);
    },

    messageDeleted(
      state: ConversationsStateType,
      action: PayloadAction<{
        messageId: string;
        conversationKey: string;
      }>
    ) {
      return handleMessageExpiredOrDeleted(state, action);
    },

    conversationReset(state: ConversationsStateType, action: PayloadAction<string>) {
      return handleConversationReset(state, action);
    },

    openConversationExternal(
      state: ConversationsStateType,
      action: PayloadAction<{
        id: string;
        firstUnreadIdOnOpen: string | undefined;
        messageId?: string;
      }>
    ) {
      if (state.selectedConversation === action.payload.id) {
        return state;
      }

      return {
        conversationLookup: state.conversationLookup,
        selectedConversation: action.payload.id,
        areMoreMessagesBeingFetched: false,
        messages: [],
        showRightPanel: false,
        selectedMessageIds: [],
        lightBox: undefined,
        messageDetailProps: undefined,
        quotedMessage: undefined,

        nextMessageToPlay: undefined,
        showScrollButton: false,
        animateQuotedMessageId: undefined,
        mentionMembers: [],
        firstUnreadMessageId: action.payload.firstUnreadIdOnOpen,
      };
    },
    showLightBox(
      state: ConversationsStateType,
      action: PayloadAction<LightBoxOptions | undefined>
    ) {
      state.lightBox = action.payload;
      return state;
    },
    showScrollToBottomButton(state: ConversationsStateType, action: PayloadAction<boolean>) {
      state.showScrollButton = action.payload;
      return state;
    },
    quoteMessage(
      state: ConversationsStateType,
      action: PayloadAction<ReplyingToMessageProps | undefined>
    ) {
      state.quotedMessage = action.payload;
      return state;
    },
    quotedMessageToAnimate(
      state: ConversationsStateType,
      action: PayloadAction<string | undefined>
    ) {
      state.animateQuotedMessageId = action.payload;
      return state;
    },
    setNextMessageToPlay(state: ConversationsStateType, action: PayloadAction<number | undefined>) {
      state.nextMessageToPlay = action.payload;
      return state;
    },
    updateMentionsMembers(
      state: ConversationsStateType,
      action: PayloadAction<MentionsMembersType>
    ) {
      window?.log?.warn('updating mentions input members length', action.payload?.length);
      state.mentionMembers = action.payload;
      return state;
    },
  },
  extraReducers: (builder: any) => {
    // Add reducers for additional action types here, and handle loading state as needed
    builder.addCase(
      fetchMessagesForConversation.fulfilled,
      (state: ConversationsStateType, action: PayloadAction<FetchedMessageResults>) => {
        // this is called once the messages are loaded from the db for the currently selected conversation
        const { messagesProps, conversationKey } = action.payload;
        // double check that this update is for the shown convo
        if (conversationKey === state.selectedConversation) {
          return {
            ...state,
            messages: messagesProps,
            areMoreMessagesBeingFetched: false,
          };
        }
        return state;
      }
    );
    builder.addCase(fetchMessagesForConversation.pending, (state: ConversationsStateType) => {
      state.areMoreMessagesBeingFetched = true;
    });
    builder.addCase(fetchMessagesForConversation.rejected, (state: ConversationsStateType) => {
      state.areMoreMessagesBeingFetched = false;
    });
  },
});

// destructures
export const { actions, reducer } = conversationsSlice;
export const {
  // conversation and messages list
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
  openConversationExternal,
  // layout stuff
  showMessageDetailsView,
  closeMessageDetailsView,
  openRightPanel,
  closeRightPanel,
  addMessageIdToSelection,
  resetSelectedMessageIds,
  toggleSelectedMessageId,
  showLightBox,
  quoteMessage,
  showScrollToBottomButton,
  quotedMessageToAnimate,
  setNextMessageToPlay,
  updateMentionsMembers,
} = actions;
