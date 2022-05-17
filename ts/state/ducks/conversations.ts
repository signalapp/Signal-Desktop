import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getConversationController } from '../../session/conversations';
import {
  getFirstUnreadMessageIdInConversation,
  getLastMessageIdInConversation,
  getLastMessageInConversation,
  getMessagesByConversation,
  getOldestMessageInConversation,
} from '../../data/data';
import {
  ConversationNotificationSettingType,
  ConversationTypeEnum,
} from '../../models/conversation';
import {
  MessageDeliveryStatus,
  MessageModelType,
  PropsForDataExtractionNotification,
  PropsForMessageRequestResponse,
} from '../../models/messageType';
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
  propsForMessageRequestResponse?: PropsForMessageRequestResponse;
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
  error?: number; // if the download somhehow failed, this will be set to true and be 0-1 once saved in the db
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
  sender: string; // this is the sender
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
    sender: string;
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
  /**
   * For a group, this is the groupName. For a private convo, this is always the realName of that user as he defined it (and so not a custom nickname)
   */
  name?: string;
  /**
   * profileName is the bad duck. if a nickname is set, this holds the value of it. Otherwise, it holds the name of that user as he defined it
   */
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
  didApproveMe?: boolean;
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

  /**
   * oldTopMessageId should only be set when, as the user scroll up we trigger a load of more top messages.
   * Saving it here, make it possible to restore the position of the user before the refresh by pointing
   * at that same messageId and aligning the list to the top.
   *
   * Once the view scrolled, this value is reseted by resetOldTopMessageId
   */

  oldTopMessageId: string | null;
  /**
   * oldBottomMessageId should only be set when, as the user scroll down we trigger a load of more bottom messages.
   * Saving it here, make it possible to restore the position of the user before the refresh by pointing
   * at that same messageId and aligning the list to the bottom.
   *
   * Once the view scrolled, this value is reseted by resetOldBottomMessageId
   */
  oldBottomMessageId: string | null;

  /**
   * Contains the most recent message id for this conversation.
   * This is the one at the bottom, if the most recent page of the conversation was loaded.
   * But this might also be a message not visible (like if the user scrolled up, the most recent message is not rendered)
   */
  mostRecentMessageId: string | null;

  showScrollButton: boolean;
  animateQuotedMessageId?: string;
  shouldHighlightMessage: boolean;
  nextMessageToPlayId?: string;
  mentionMembers: MentionsMembersType;
};

export type MentionsMembersType = Array<{
  id: string;
  authorProfileName: string;
}>;

async function getMessages({
  conversationKey,
  messageId,
}: {
  conversationKey: string;
  messageId: string | null;
}): Promise<Array<MessageModelPropsWithoutConvoProps>> {
  const beforeTimestamp = Date.now();

  const conversation = getConversationController().get(conversationKey);
  if (!conversation) {
    // no valid conversation, early return
    window?.log?.error('Failed to get convo on reducer.');
    return [];
  }

  const messageSet = await getMessagesByConversation(conversationKey, {
    messageId,
  });

  const messageProps: Array<MessageModelPropsWithoutConvoProps> = messageSet.models.map(m =>
    m.getMessageModelProps()
  );
  const time = Date.now() - beforeTimestamp;
  window?.log?.info(`Loading ${messageProps.length} messages took ${time}ms to load.`);
  return messageProps;
}

export type SortedMessageModelProps = MessageModelPropsWithoutConvoProps & {
  firstMessageOfSeries: boolean;
  lastMessageOfSeries: boolean;
};

type FetchedTopMessageResults = {
  conversationKey: string;
  messagesProps: Array<MessageModelPropsWithoutConvoProps>;
  oldTopMessageId: string | null;
} | null;

export const fetchTopMessagesForConversation = createAsyncThunk(
  'messages/fetchTopByConversationKey',
  async ({
    conversationKey,
    oldTopMessageId,
  }: {
    conversationKey: string;
    oldTopMessageId: string | null;
  }): Promise<FetchedTopMessageResults> => {
    // no need to load more top if we are already at the top
    const oldestMessage = await getOldestMessageInConversation(conversationKey);

    if (!oldestMessage || oldestMessage.id === oldTopMessageId) {
      window.log.info('fetchTopMessagesForConversation: we are already at the top');
      return null;
    }
    const messagesProps = await getMessages({
      conversationKey,
      messageId: oldTopMessageId,
    });

    return {
      conversationKey,
      messagesProps,
      oldTopMessageId,
    };
  }
);

type FetchedBottomMessageResults = {
  conversationKey: string;
  messagesProps: Array<MessageModelPropsWithoutConvoProps>;
  oldBottomMessageId: string | null;
  newMostRecentMessageIdInConversation: string | null;
} | null;

export const fetchBottomMessagesForConversation = createAsyncThunk(
  'messages/fetchBottomByConversationKey',
  async ({
    conversationKey,
    oldBottomMessageId,
  }: {
    conversationKey: string;
    oldBottomMessageId: string | null;
  }): Promise<FetchedBottomMessageResults> => {
    // no need to load more bottom if we are already at the bottom
    const mostRecentMessage = await getLastMessageInConversation(conversationKey);

    if (!mostRecentMessage || mostRecentMessage.id === oldBottomMessageId) {
      window.log.info('fetchBottomMessagesForConversation: we are already at the bottom');
      return null;
    }
    const messagesProps = await getMessages({
      conversationKey,
      messageId: oldBottomMessageId,
    });

    return {
      conversationKey,
      messagesProps,
      oldBottomMessageId,
      newMostRecentMessageIdInConversation: mostRecentMessage.id,
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
    areMoreMessagesBeingFetched: false, // top or bottom
    showScrollButton: false,
    mentionMembers: [],
    firstUnreadMessageId: undefined,
    oldTopMessageId: null,
    oldBottomMessageId: null,
    shouldHighlightMessage: false,
    mostRecentMessageId: null,
  };
}

function handleMessageChangedOrAdded(
  state: ConversationsStateType,
  changedOrAddedMessageProps: MessageModelPropsWithoutConvoProps
) {
  if (changedOrAddedMessageProps.propsForMessage.convoId !== state.selectedConversation) {
    return state;
  }

  const messageInStoreIndex = state.messages.findIndex(
    m => m.propsForMessage.id === changedOrAddedMessageProps.propsForMessage.id
  );
  if (messageInStoreIndex >= 0) {
    state.messages[messageInStoreIndex] = changedOrAddedMessageProps;

    return state;
  }

  // this message was not present before in the state, and we assume it was added at the bottom.
  // as showScrollButton is set, it means we are not scrolled down, hence, that message is not visible
  // this is to avoid adding messages at the bottom when we are scrolled up looking at old messages. The new message which just came in is not going to at his right place by adding it at the end here.
  if (state.showScrollButton) {
    return state;
  }
  // sorting happens in the selector

  state.messages.push(changedOrAddedMessageProps);
  return state;
}

function handleMessagesChangedOrAdded(
  state: ConversationsStateType,
  payload: Array<MessageModelPropsWithoutConvoProps>
) {
  payload.forEach(element => {
    // tslint:disable-next-line: no-parameter-reassignment
    state = handleMessageChangedOrAdded(state, element);
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
      return applyConversationChanged(state, payload);
    },
    conversationsChanged(
      state: ConversationsStateType,
      action: PayloadAction<Array<ReduxConversationType>>
    ) {
      const { payload } = action;

      let updatedState = state;
      if (payload.length) {
        payload.forEach(convoProps => {
          updatedState = applyConversationChanged(updatedState, {
            id: convoProps.id,
            data: convoProps,
          });
        });
      }

      return updatedState;
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

    messagesChanged(
      state: ConversationsStateType,
      action: PayloadAction<Array<MessageModelPropsWithoutConvoProps>>
    ) {
      return handleMessagesChangedOrAdded(state, action.payload);
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
        shouldHighlightMessage: false,
        firstUnreadMessageId: undefined,
      };
    },
    /**
     * Closes any existing conversation and returns state to the placeholder screen
     */
    resetConversationExternal(state: ConversationsStateType) {
      return { ...getEmptyConversationState(), conversationLookup: state.conversationLookup };
    },
    openConversationExternal(
      state: ConversationsStateType,
      action: PayloadAction<{
        conversationKey: string;
        firstUnreadIdOnOpen: string | undefined;
        mostRecentMessageIdOnOpen: string | null;
        initialMessages: Array<MessageModelPropsWithoutConvoProps>;
      }>
    ) {
      if (state.selectedConversation === action.payload.conversationKey) {
        return state;
      }

      // this is quite hacky, but we don't want to show the showScrollButton if we have only a small amount of messages,
      // or if the first unread message is not far from the most recent one.
      // this is because when a new message get added, we do not add it to redux depending on the showScrollButton state.
      const messagesToConsiderForShowingUnreadBanner = 10;

      let showScrollButton = Boolean(action.payload.firstUnreadIdOnOpen);

      if (
        action.payload.initialMessages?.length <= messagesToConsiderForShowingUnreadBanner ||
        action.payload.initialMessages
          ?.slice(0, messagesToConsiderForShowingUnreadBanner)
          .some(n => n.propsForMessage.id === action.payload.firstUnreadIdOnOpen)
      ) {
        showScrollButton = false;
      }
      return {
        conversationLookup: state.conversationLookup,
        mostRecentMessageId: action.payload.mostRecentMessageIdOnOpen,
        selectedConversation: action.payload.conversationKey,
        firstUnreadMessageId: action.payload.firstUnreadIdOnOpen,
        messages: action.payload.initialMessages,

        areMoreMessagesBeingFetched: false,
        showRightPanel: false,
        selectedMessageIds: [],

        lightBox: undefined,
        messageDetailProps: undefined,
        quotedMessage: undefined,

        nextMessageToPlay: undefined,
        showScrollButton,
        animateQuotedMessageId: undefined,
        shouldHighlightMessage: false,
        oldTopMessageId: null,
        oldBottomMessageId: null,
        mentionMembers: [],
      };
    },
    openConversationToSpecificMessage(
      state: ConversationsStateType,
      action: PayloadAction<{
        conversationKey: string;
        messageIdToNavigateTo: string;
        shouldHighlightMessage: boolean;
        mostRecentMessageIdOnOpen: string | null;

        initialMessages: Array<MessageModelPropsWithoutConvoProps>;
      }>
    ) {
      return {
        ...state,
        selectedConversation: action.payload.conversationKey,
        mostRecentMessageIdOnOpen: action.payload.mostRecentMessageIdOnOpen,
        areMoreMessagesBeingFetched: false,
        messages: action.payload.initialMessages,
        showScrollButton: Boolean(
          action.payload.messageIdToNavigateTo !== action.payload.mostRecentMessageIdOnOpen
        ),
        animateQuotedMessageId: action.payload.messageIdToNavigateTo,
        shouldHighlightMessage: action.payload.shouldHighlightMessage,
        oldTopMessageId: null,
        oldBottomMessageId: null,
      };
    },
    resetOldTopMessageId(state: ConversationsStateType) {
      state.oldTopMessageId = null;
      return state;
    },
    resetOldBottomMessageId(state: ConversationsStateType) {
      state.oldBottomMessageId = null;
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
      state.shouldHighlightMessage = Boolean(state.animateQuotedMessageId);
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
      fetchTopMessagesForConversation.fulfilled,
      (
        state: ConversationsStateType,
        action: PayloadAction<FetchedTopMessageResults>
      ): ConversationsStateType => {
        if (!action.payload) {
          return { ...state, areMoreMessagesBeingFetched: false };
        }
        // this is called once the messages are loaded from the db for the currently selected conversation
        const { messagesProps, conversationKey, oldTopMessageId } = action.payload;
        // double check that this update is for the shown convo
        if (conversationKey === state.selectedConversation) {
          return {
            ...state,
            oldTopMessageId,
            messages: messagesProps,
            areMoreMessagesBeingFetched: false,
          };
        }
        return state;
      }
    );
    builder.addCase(
      fetchTopMessagesForConversation.pending,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = true;
        return state;
      }
    );
    builder.addCase(
      fetchTopMessagesForConversation.rejected,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = false;
        return state;
      }
    );
    builder.addCase(
      fetchBottomMessagesForConversation.fulfilled,
      (
        state: ConversationsStateType,
        action: PayloadAction<FetchedBottomMessageResults>
      ): ConversationsStateType => {
        if (!action.payload) {
          return { ...state, areMoreMessagesBeingFetched: false };
        }
        // this is called once the messages are loaded from the db for the currently selected conversation
        const {
          messagesProps,
          conversationKey,
          oldBottomMessageId,
          newMostRecentMessageIdInConversation,
        } = action.payload;
        // double check that this update is for the shown convo
        if (conversationKey === state.selectedConversation) {
          return {
            ...state,
            oldBottomMessageId,
            messages: messagesProps,
            areMoreMessagesBeingFetched: false,
            mostRecentMessageId: newMostRecentMessageIdInConversation,
          };
        }
        return state;
      }
    );
    builder.addCase(
      fetchBottomMessagesForConversation.pending,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = true;
        return state;
      }
    );
    builder.addCase(
      fetchBottomMessagesForConversation.rejected,
      (state: ConversationsStateType): ConversationsStateType => {
        state.areMoreMessagesBeingFetched = false;
        return state;
      }
    );
  },
});

function applyConversationChanged(
  state: ConversationsStateType,
  payload: { id: string; data: ReduxConversationType }
) {
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

// destructures
export const { actions, reducer } = conversationsSlice;
export const {
  // conversation and messages list
  conversationAdded,
  conversationChanged,
  conversationsChanged,
  conversationRemoved,
  removeAllConversations,
  messageExpired,
  messageDeleted,
  conversationReset,
  messagesChanged,
  resetOldTopMessageId,
  resetOldBottomMessageId,
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
  resetConversationExternal,
} = actions;

export async function openConversationWithMessages(args: {
  conversationKey: string;
  messageId: string | null;
}) {
  const { conversationKey, messageId } = args;
  const firstUnreadIdOnOpen = await getFirstUnreadMessageIdInConversation(conversationKey);
  const mostRecentMessageIdOnOpen = await getLastMessageIdInConversation(conversationKey);

  const initialMessages = await getMessages({
    conversationKey,
    messageId: messageId || null,
  });

  window.inboxStore?.dispatch(
    actions.openConversationExternal({
      conversationKey,
      firstUnreadIdOnOpen,
      mostRecentMessageIdOnOpen,
      initialMessages,
    })
  );
}

export async function openConversationToSpecificMessage(args: {
  conversationKey: string;
  messageIdToNavigateTo: string;
  shouldHighlightMessage: boolean;
}) {
  const { conversationKey, messageIdToNavigateTo, shouldHighlightMessage } = args;

  const messagesAroundThisMessage = await getMessages({
    conversationKey,
    messageId: messageIdToNavigateTo,
  });

  const mostRecentMessageIdOnOpen = await getLastMessageIdInConversation(conversationKey);

  // we do not care about the firstunread message id when opening to a specific message
  window.inboxStore?.dispatch(
    actions.openConversationToSpecificMessage({
      conversationKey,
      messageIdToNavigateTo,
      mostRecentMessageIdOnOpen,
      shouldHighlightMessage,
      initialMessages: messagesAroundThisMessage,
    })
  );
}
