import { Constants } from '../../session';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getConversationController } from '../../session/conversations';
import { getFirstUnreadMessageIdInConversation, getMessagesByConversation } from '../../data/data';
import {
  ConversationNotificationSettingType,
  ConversationTypeEnum,
} from '../../models/conversation';
import {
  MessageDeliveryStatus,
  MessageModelType,
  PropsForDataExtractionNotification,
} from '../../models/messageType';
import { perfEnd, perfStart } from '../../session/utils/Performance';
import { omit } from 'lodash';
import { ReplyingToMessageProps } from '../../components/conversation/composition/CompositionBox';
import { QuotedAttachmentType } from '../../components/conversation/message/message-content/Quote';
import { LightBoxOptions } from '../../components/conversation/SessionConversation';

export type CallNotificationType = 'missed-call' | 'started-call' | 'answered-a-call';
export type PropsForCallNotification = {
  notificationType: CallNotificationType;
  messageId: string;
  receivedAt: number;
  isUnread: boolean;
};

export type MessageModelPropsWithoutConvoProps = {
  propsForMessage: PropsForMessageWithoutConvoProps;
  propsForGroupInvitation?: PropsForGroupInvitation;
  propsForTimerNotification?: PropsForExpirationTimer;
  propsForDataExtractionNotification?: PropsForDataExtractionNotification;
  propsForGroupUpdateMessage?: PropsForGroupUpdate;
  propsForCallNotification?: PropsForCallNotification;
};

export type MessageModelPropsWithConvoProps = SortedMessageModelProps & {
  propsForMessage: PropsForMessageWithConvoProps;
};

export type ContactPropsMessageDetail = {
  status: string | undefined;
  pubkey: string;
  name?: string | null;
  profileName?: string | null;
  avatarPath?: string | null;
  isOutgoingKeyError: boolean;

  errors?: Array<Error>;
};

export type MessagePropsDetails = {
  sentAt: number;
  receivedAt: number;
  errors: Array<Error>;
  contacts: Array<ContactPropsMessageDetail>;
  convoId: string;
  messageId: string;
  direction: MessageModelType;
};

export type LastMessageStatusType = MessageDeliveryStatus | undefined;

export type FindAndFormatContactType = {
  pubkey: string;
  avatarPath: string | null;
  name: string | null;
  profileName: string | null;
  title: string | null;
  isMe: boolean;
};

export type PropsForExpirationTimer = {
  timespan: string;
  disabled: boolean;
  pubkey: string;
  avatarPath: string | null;
  name: string | null;
  profileName: string | null;
  title: string | null;
  type: 'fromMe' | 'fromSync' | 'fromOther';
  messageId: string;
  isUnread: boolean;
  receivedAt: number | undefined;
};

export type PropsForGroupUpdateGeneral = {
  type: 'general';
};

export type PropsForGroupUpdateAdd = {
  type: 'add';
  added: Array<string>;
};

export type PropsForGroupUpdateKicked = {
  type: 'kicked';
  kicked: Array<string>;
};

export type PropsForGroupUpdateLeft = {
  type: 'left';
  left: Array<string>;
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
  | PropsForGroupUpdateLeft;

export type PropsForGroupUpdate = {
  change: PropsForGroupUpdateType;
  messageId: string;
  receivedAt: number | undefined;
  isUnread: boolean;
};

export type PropsForGroupInvitation = {
  serverName: string;
  url: string;
  direction: MessageModelType;
  acceptUrl: string;
  messageId: string;
  receivedAt?: number;
  isUnread: boolean;
};

export type PropsForAttachment = {
  id: number;
  contentType: string;
  caption?: string;
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

export type PropsForMessageWithoutConvoProps = {
  id: string; // messageId
  direction: MessageModelType;
  timestamp: number;
  authorPhoneNumber: string; // this is the sender
  convoId: string; // this is the conversation in which this message was sent
  text?: string;

  receivedAt?: number;
  serverTimestamp?: number;
  serverId?: number;
  status?: LastMessageStatusType;
  attachments?: Array<PropsForAttachment>;
  previews?: Array<any>;
  quote?: {
    text?: string;
    attachment?: QuotedAttachmentType;
    isFromMe?: boolean;
    authorPhoneNumber: string;
    authorProfileName?: string;
    authorName?: string;
    messageId?: string;
    referencedMessageNotFound?: boolean;
  } | null;
  messageHash?: string;
  isDeleted?: boolean;
  isUnread?: boolean;
  expirationLength?: number;
  expirationTimestamp?: number | null;
  isExpired?: boolean;
  isTrustedForAttachmentDownload?: boolean;
};

export type PropsForMessageWithConvoProps = PropsForMessageWithoutConvoProps & {
  authorName: string | null;
  authorProfileName: string | null;
  conversationType: ConversationTypeEnum;
  authorAvatarPath: string | null;
  isPublic: boolean;
  isOpenGroupV2: boolean;
  isKickedFromGroup: boolean;
  weAreAdmin: boolean;
  isSenderAdmin: boolean;
  isDeletable: boolean;
  isDeletableForEveryone: boolean;
  isBlocked: boolean;
  isDeleted?: boolean;
};

export type LastMessageType = {
  status: LastMessageStatusType;
  text: string | null;
};

export interface ReduxConversationType {
  id: string;
  name?: string;
  profileName?: string;
  hasNickname?: boolean;

  activeAt?: number;
  lastMessage?: LastMessageType;
  type: ConversationTypeEnum;
  isMe?: boolean;
  isPublic?: boolean;
  isGroup?: boolean;
  isPrivate?: boolean;
  weAreAdmin?: boolean;
  unreadCount?: number;
  mentionedUs?: boolean;
  isSelected?: boolean;
  expireTimer?: number;

  isTyping?: boolean;
  isBlocked?: boolean;
  isKickedFromGroup?: boolean;
  subscriberCount?: number;
  left?: boolean;
  avatarPath?: string | null; // absolute filepath to the avatar
  groupAdmins?: Array<string>; // admins for closed groups and moderators for open groups
  members?: Array<string>; // members for closed groups only
  zombies?: Array<string>; // members for closed groups only

  /**
   * If this is undefined, it means all notification are enabled
   */
  currentNotificationSetting?: ConversationNotificationSettingType;

  isPinned?: boolean;
  isApproved?: boolean;
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
  messages: Array<MessageModelPropsWithoutConvoProps>;
  firstUnreadMessageId: string | undefined;
  messageDetailProps?: MessagePropsDetails;
  showRightPanel: boolean;
  selectedMessageIds: Array<string>;
  lightBox?: LightBoxOptions;
  quotedMessage?: ReplyingToMessageProps;
  areMoreMessagesBeingFetched: boolean;
  haveDoneFirstScroll: boolean;

  showScrollButton: boolean;
  animateQuotedMessageId?: string;
  nextMessageToPlayId?: string;
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
): Promise<Array<MessageModelPropsWithoutConvoProps>> {
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

  const messageProps: Array<MessageModelPropsWithoutConvoProps> = messageSet.models.map(m =>
    m.getMessageModelProps()
  );
  return messageProps;
}

export type SortedMessageModelProps = MessageModelPropsWithoutConvoProps & {
  firstMessageOfSeries: boolean;
  lastMessageOfSeries: boolean;
};

type FetchedMessageResults = {
  conversationKey: string;
  messagesProps: Array<MessageModelPropsWithoutConvoProps>;
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
    perfStart('fetchMessagesForConversation');
    const messagesProps = await getMessages(conversationKey, count);
    const afterTimestamp = Date.now();
    // tslint:disable-next-line: no-console
    perfEnd('fetchMessagesForConversation', 'fetchMessagesForConversation');

    const time = afterTimestamp - beforeTimestamp;
    window?.log?.info(`Loading ${messagesProps.length} messages took ${time}ms to load.`);

    return {
      conversationKey,
      messagesProps,
    };
  }
);

// Reducer

export function getEmptyConversationState(): ConversationsStateType {
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
    haveDoneFirstScroll: false,
  };
}

function handleMessageAdded(
  state: ConversationsStateType,
  payload: {
    conversationKey: string;
    messageModelProps: MessageModelPropsWithoutConvoProps;
  }
) {
  const { messages } = state;
  const { conversationKey, messageModelProps: addedMessageProps } = payload;
  if (conversationKey === state.selectedConversation) {
    const messageInStoreIndex = state?.messages?.findIndex(
      m => m.propsForMessage.id === addedMessageProps.propsForMessage.id
    );
    if (messageInStoreIndex >= 0) {
      // we cannot edit the array directly, so slice the first part, insert our edited message, and slice the second part
      const editedMessages = [
        ...state.messages.slice(0, messageInStoreIndex),
        addedMessageProps,
        ...state.messages.slice(messageInStoreIndex + 1),
      ];

      return {
        ...state,
        messages: editedMessages,
      };
    }

    return {
      ...state,
      messages: [...messages, addedMessageProps], // sorting happens in the selector
    };
  }
  return state;
}

function handleMessageChanged(
  state: ConversationsStateType,
  changedMessage: MessageModelPropsWithoutConvoProps
) {
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

function handleMessagesChanged(
  state: ConversationsStateType,
  payload: Array<MessageModelPropsWithoutConvoProps>
) {
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
  initialState: getEmptyConversationState(),
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
      return getEmptyConversationState();
    },

    messageAdded(
      state: ConversationsStateType,
      action: PayloadAction<{
        conversationKey: string;
        messageModelProps: MessageModelPropsWithoutConvoProps;
      }>
    ) {
      return handleMessageAdded(state, action.payload);
    },
    messagesAdded(
      state: ConversationsStateType,
      action: PayloadAction<
        Array<{
          conversationKey: string;
          messageModelProps: MessageModelPropsWithoutConvoProps;
        }>
      >
    ) {
      perfStart('messagesAdded');
      action.payload.forEach(added => {
        // tslint:disable-next-line: no-parameter-reassignment
        state = handleMessageAdded(state, added);
      });
      perfEnd('messagesAdded', 'messagesAdded');

      return state;
    },

    messageChanged(
      state: ConversationsStateType,
      action: PayloadAction<MessageModelPropsWithoutConvoProps>
    ) {
      return handleMessageChanged(state, action.payload);
    },
    messagesChanged(
      state: ConversationsStateType,
      action: PayloadAction<Array<MessageModelPropsWithoutConvoProps>>
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

    markConversationFullyRead(state: ConversationsStateType, action: PayloadAction<string>) {
      if (state.selectedConversation !== action.payload) {
        return state;
      }

      // keep the unread visible just like in other apps. It will be shown until the user changes convo
      return {
        ...state,
        firstUnreadMessageId: undefined,
      };
    },

    openConversationExternal(
      state: ConversationsStateType,
      action: PayloadAction<{
        id: string;
        firstUnreadIdOnOpen: string | undefined;
        initialMessages: Array<MessageModelPropsWithoutConvoProps>;
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
        messages: action.payload.initialMessages,
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

        haveDoneFirstScroll: false,
      };
    },
    updateHaveDoneFirstScroll(state: ConversationsStateType) {
      state.haveDoneFirstScroll = true;
      return state;
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
    setNextMessageToPlayId(
      state: ConversationsStateType,
      action: PayloadAction<string | undefined>
    ) {
      state.nextMessageToPlayId = action.payload;
      return state;
    },
    updateMentionsMembers(
      state: ConversationsStateType,
      action: PayloadAction<MentionsMembersType>
    ) {
      window?.log?.info('updating mentions input members length', action.payload?.length);
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
  messagesAdded,
  messageDeleted,
  conversationReset,
  messageChanged,
  messagesChanged,
  updateHaveDoneFirstScroll,
  markConversationFullyRead,
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
  setNextMessageToPlayId,
  updateMentionsMembers,
} = actions;

export async function openConversationWithMessages(args: {
  conversationKey: string;
  messageId?: string;
}) {
  const { conversationKey, messageId } = args;
  perfStart('getFirstUnreadMessageIdInConversation');
  const firstUnreadIdOnOpen = await getFirstUnreadMessageIdInConversation(conversationKey);
  perfEnd('getFirstUnreadMessageIdInConversation', 'getFirstUnreadMessageIdInConversation');

  // preload 30 messages
  perfStart('getMessages');

  const initialMessages = await getMessages(conversationKey, 30);
  perfEnd('getMessages', 'getMessages');

  window.inboxStore?.dispatch(
    actions.openConversationExternal({
      id: conversationKey,
      firstUnreadIdOnOpen,
      messageId,
      initialMessages,
    })
  );
}
