import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  ConversationLookupType,
  ConversationsStateType,
  MentionsMembersType,
  MessageModelPropsWithConvoProps,
  MessageModelPropsWithoutConvoProps,
  MessagePropsDetails,
  ReduxConversationType,
  SortedMessageModelProps,
} from '../ducks/conversations';

import { getIntl, getOurNumber } from './user';
import { BlockedNumberController } from '../../util';
import { ConversationModel, ConversationTypeEnum } from '../../models/conversation';
import { LocalizerType } from '../../types/Util';
import { ConversationHeaderTitleProps } from '../../components/conversation/ConversationHeader';
import _ from 'lodash';
import { ReplyingToMessageProps } from '../../components/conversation/composition/CompositionBox';
import { MessageAttachmentSelectorProps } from '../../components/conversation/message/message-content/MessageAttachment';
import { MessageAuthorSelectorProps } from '../../components/conversation/message/message-content/MessageAuthorText';
import { MessageAvatarSelectorProps } from '../../components/conversation/message/message-content/MessageAvatar';
import { MessageContentSelectorProps } from '../../components/conversation/message/message-content/MessageContent';
import { MessageContentWithStatusSelectorProps } from '../../components/conversation/message/message-content/MessageContentWithStatus';
import { MessageContextMenuSelectorProps } from '../../components/conversation/message/message-content/MessageContextMenu';
import { MessagePreviewSelectorProps } from '../../components/conversation/message/message-content/MessagePreview';
import { MessageQuoteSelectorProps } from '../../components/conversation/message/message-content/MessageQuote';
import { MessageStatusSelectorProps } from '../../components/conversation/message/message-content/MessageStatus';
import { MessageTextSelectorProps } from '../../components/conversation/message/message-content/MessageText';
import { GenericReadableMessageSelectorProps } from '../../components/conversation/message/message-item/GenericReadableMessage';
import { LightBoxOptions } from '../../components/conversation/SessionConversation';
import { getConversationController } from '../../session/conversations';
import { UserUtils } from '../../session/utils';
import { Storage } from '../../util/storage';

export const getConversations = (state: StateType): ConversationsStateType => state.conversations;

export const getConversationLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationLookup;
  }
);

export const getConversationsCount = createSelector(getConversationLookup, (state): number => {
  return Object.values(state).length;
});

export const getBlockedPubkeys = createSelector(
  // make sure to extends this selector to we are rerun on conversation changes
  getConversationLookup,

  (_state): Array<string> => {
    return BlockedNumberController.getBlockedNumbers();
  }
);

export const getSelectedConversationKey = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.selectedConversation;
  }
);

export const getSelectedConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): ReduxConversationType | undefined => {
    return state.selectedConversation
      ? state.conversationLookup[state.selectedConversation]
      : undefined;
  }
);

export const getSelectedConversationIsPublic = createSelector(
  getSelectedConversation,
  (state: ReduxConversationType | undefined): boolean => {
    return state?.isPublic || false;
  }
);

export const getIsTypingEnabled = createSelector(
  getConversations,
  getSelectedConversationKey,
  (state: ConversationsStateType, selectedConvoPubkey?: string): boolean => {
    if (!selectedConvoPubkey) {
      return false;
    }
    const selectedConvo = state.conversationLookup[selectedConvoPubkey];
    if (!selectedConvo) {
      return false;
    }
    const { isBlocked, isKickedFromGroup, left } = selectedConvo;

    return !(isBlocked || isKickedFromGroup || left);
  }
);
/**
 * Returns true if the current conversation selected is a group conversation.
 * Returns false if the current conversation selected is not a group conversation, or none are selected
 */
export const isGroupConversation = createSelector(
  getSelectedConversation,
  (state: ReduxConversationType | undefined): boolean => {
    return state?.type === 'group' || false;
  }
);

/**
 * Returns true if the current conversation selected is a closed group and false otherwise.
 */
export const isClosedGroupConversation = createSelector(
  getSelectedConversation,
  (state: ReduxConversationType | undefined): boolean => {
    return (state?.type === 'group' && !state.isPublic) || false;
  }
);

/**
 * Returns true if the current conversation selected is a public group and false otherwise.
 */
export const isPublicGroupConversation = createSelector(
  getSelectedConversation,
  (state: ReduxConversationType | undefined): boolean => {
    return (state?.type === 'group' && state.isPublic) || false;
  }
);

export const getOurPrimaryConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): ReduxConversationType =>
    state.conversationLookup[Storage.get('primaryDevicePubKey') as string]
);

const getMessagesOfSelectedConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): Array<MessageModelPropsWithoutConvoProps> => state.messages
);

// Redux recommends to do filtered and deriving state in a selector rather than ourself
export const getSortedMessagesOfSelectedConversation = createSelector(
  getMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): Array<SortedMessageModelProps> => {
    if (messages.length === 0) {
      return [];
    }

    const convoId = messages[0].propsForMessage.convoId;
    const convo = getConversationController().get(convoId);

    if (!convo) {
      return [];
    }

    const isPublic = convo.isPublic() || false;
    const sortedMessage = sortMessages(messages, isPublic);

    return updateFirstMessageOfSeries(sortedMessage);
  }
);

const getFirstUnreadMessageId = createSelector(getConversations, (state: ConversationsStateType):
  | string
  | undefined => {
  return state.firstUnreadMessageId;
});

export const getConversationHasUnread = createSelector(getFirstUnreadMessageId, unreadId => {
  return Boolean(unreadId);
});

export type MessagePropsType =
  | 'group-notification'
  | 'group-invitation'
  | 'data-extraction'
  | 'message-request-response'
  | 'timer-notification'
  | 'regular-message'
  | 'unread-indicator'
  | 'call-notification';

export const getSortedMessagesTypesOfSelectedConversation = createSelector(
  getSortedMessagesOfSelectedConversation,
  getFirstUnreadMessageId,
  (sortedMessages, firstUnreadId) => {
    const maxMessagesBetweenTwoDateBreaks = 5;
    // we want to show the date break if there is a large jump in time
    // remember that messages are sorted from the most recent to the oldest
    return sortedMessages.map((msg, index) => {
      const isFirstUnread = Boolean(firstUnreadId === msg.propsForMessage.id);
      const messageTimestamp = msg.propsForMessage.serverTimestamp || msg.propsForMessage.timestamp;
      // do not show the date break if we are the oldest message (no previous)
      // this is to smooth a bit the loading of older message (to avoid a jump once new messages are rendered)
      const previousMessageTimestamp =
        index + 1 >= sortedMessages.length
          ? Number.MAX_SAFE_INTEGER
          : sortedMessages[index + 1].propsForMessage.serverTimestamp ||
            sortedMessages[index + 1].propsForMessage.timestamp;

      const showDateBreak =
        messageTimestamp - previousMessageTimestamp > maxMessagesBetweenTwoDateBreaks * 60 * 1000
          ? messageTimestamp
          : undefined;

      if (msg.propsForDataExtractionNotification) {
        return {
          showUnreadIndicator: isFirstUnread,
          showDateBreak,
          message: {
            messageType: 'data-extraction',
            props: { ...msg.propsForDataExtractionNotification, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForMessageRequestResponse) {
        return {
          showUnreadIndicator: isFirstUnread,
          showDateBreak,
          message: {
            messageType: 'message-request-response',
            props: { ...msg.propsForMessageRequestResponse, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForGroupInvitation) {
        return {
          showUnreadIndicator: isFirstUnread,
          showDateBreak,
          message: {
            messageType: 'group-invitation',
            props: { ...msg.propsForGroupInvitation, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForGroupUpdateMessage) {
        return {
          showUnreadIndicator: isFirstUnread,
          showDateBreak,
          message: {
            messageType: 'group-notification',
            props: { ...msg.propsForGroupUpdateMessage, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForTimerNotification) {
        return {
          showUnreadIndicator: isFirstUnread,
          showDateBreak,
          message: {
            messageType: 'timer-notification',
            props: { ...msg.propsForTimerNotification, messageId: msg.propsForMessage.id },
          },
        };
      }

      if (msg.propsForCallNotification) {
        return {
          showUnreadIndicator: isFirstUnread,
          showDateBreak,
          message: {
            messageType: 'call-notification',
            props: {
              ...msg.propsForCallNotification,
              messageId: msg.propsForMessage.id,
            },
          },
        };
      }

      return {
        showUnreadIndicator: isFirstUnread,
        showDateBreak,
        message: {
          messageType: 'regular-message',
          props: { messageId: msg.propsForMessage.id },
        },
      };
    });
  }
);

function getConversationTitle(
  conversation: ReduxConversationType,
  testingi18n?: LocalizerType
): string {
  if (conversation.name) {
    return conversation.name;
  }

  if (conversation.type === 'group') {
    return (testingi18n || window.i18n)('unknown');
  }
  return conversation.id;
}

const collator = new Intl.Collator();

export const _getConversationComparator = (testingi18n?: LocalizerType) => {
  return (left: ReduxConversationType, right: ReduxConversationType): number => {
    // Pin is the first criteria to check
    if (left.isPinned && !right.isPinned) {
      return -1;
    }
    if (!left.isPinned && right.isPinned) {
      return 1;
    }
    // Then if none is pinned, check other criteria
    const leftActiveAt = left.activeAt;
    const rightActiveAt = right.activeAt;
    if (leftActiveAt && !rightActiveAt) {
      return -1;
    }
    if (rightActiveAt && !leftActiveAt) {
      return 1;
    }
    if (leftActiveAt && rightActiveAt && leftActiveAt !== rightActiveAt) {
      return rightActiveAt - leftActiveAt;
    }
    const leftTitle = getConversationTitle(left, testingi18n).toLowerCase();
    const rightTitle = getConversationTitle(right, testingi18n).toLowerCase();

    return collator.compare(leftTitle, rightTitle);
  };
};

export const getConversationComparator = createSelector(getIntl, _getConversationComparator);

// export only because we use it in some of our tests
// tslint:disable-next-line: cyclomatic-complexity
export const _getLeftPaneLists = (
  sortedConversations: Array<ReduxConversationType>
): {
  conversations: Array<ReduxConversationType>;
  contacts: Array<ReduxConversationType>;
  unreadCount: number;
} => {
  const conversations: Array<ReduxConversationType> = [];
  const directConversations: Array<ReduxConversationType> = [];

  let unreadCount = 0;
  for (const conversation of sortedConversations) {
    if (
      conversation.activeAt !== undefined &&
      conversation.type === ConversationTypeEnum.PRIVATE &&
      conversation.isApproved &&
      !conversation.isBlocked
    ) {
      directConversations.push(conversation);
    }

    if (!conversation.isApproved && conversation.isPrivate) {
      // dont increase unread counter, don't push to convo list.
      continue;
    }

    if (conversation.isBlocked) {
      continue;
    }

    if (
      unreadCount < 9 &&
      conversation.unreadCount &&
      conversation.unreadCount > 0 &&
      conversation.currentNotificationSetting !== 'disabled'
    ) {
      unreadCount += conversation.unreadCount;
    }

    conversations.push(conversation);
  }

  return {
    conversations,
    contacts: directConversations,
    unreadCount,
  };
};

export const _getSortedConversations = (
  lookup: ConversationLookupType,
  comparator: (left: ReduxConversationType, right: ReduxConversationType) => number,
  selectedConversation?: string
): Array<ReduxConversationType> => {
  const values = Object.values(lookup);
  const sorted = values.sort(comparator);

  const sortedConversations: Array<ReduxConversationType> = [];

  for (let conversation of sorted) {
    if (selectedConversation === conversation.id) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    const isBlocked =
      BlockedNumberController.isBlocked(conversation.id) ||
      BlockedNumberController.isGroupBlocked(conversation.id);

    if (isBlocked) {
      conversation = {
        ...conversation,
        isBlocked: true,
      };
    }

    // Add Open Group to list as soon as the name has been set
    if (conversation.isPublic && (!conversation.name || conversation.name === 'Unknown group')) {
      continue;
    }

    // Remove all invalid conversations and conversatons of devices associated
    //  with cancelled attempted links
    if (!conversation.isPublic && !conversation.activeAt) {
      continue;
    }

    sortedConversations.push(conversation);
  }

  return sortedConversations;
};

export const getSortedConversations = createSelector(
  getConversationLookup,
  getConversationComparator,
  getSelectedConversationKey,
  _getSortedConversations
);

/**
 *
 * @param sortedConversations List of conversations that are valid for both requests and regular conversation inbox
 * @returns A list of message request conversations.
 */
const _getConversationRequests = (
  sortedConversations: Array<ReduxConversationType>
): Array<ReduxConversationType> => {
  return _.filter(sortedConversations, conversation => {
    const { isApproved, isBlocked, isPrivate, isMe } = conversation;
    const isRequest = ConversationModel.hasValidIncomingRequestValues({
      isApproved,
      isBlocked,
      isPrivate,
      isMe,
    });
    return isRequest;
  });
};

export const getConversationRequests = createSelector(
  getSortedConversations,
  _getConversationRequests
);

const _getUnreadConversationRequests = (
  sortedConversationRequests: Array<ReduxConversationType>
): Array<ReduxConversationType> => {
  return _.filter(sortedConversationRequests, conversation => {
    return conversation && conversation.unreadCount && conversation.unreadCount > 0;
  });
};

export const getUnreadConversationRequests = createSelector(
  getConversationRequests,
  _getUnreadConversationRequests
);

const _getPrivateContactsPubkeys = (
  sortedConversations: Array<ReduxConversationType>
): Array<string> => {
  return _.filter(sortedConversations, conversation => {
    return (
      conversation.isPrivate &&
      !conversation.isBlocked &&
      !conversation.isMe &&
      conversation.didApproveMe &&
      conversation.isApproved &&
      Boolean(conversation.activeAt)
    );
  }).map(convo => convo.id);
};

/**
 * Returns all the conversation ids of private conversations which are
 * - private
 * - not me
 * - not blocked
 * - approved (or message requests are disabled)
 * - active_at is set to something truthy
 */
export const getPrivateContactsPubkeys = createSelector(
  getSortedConversations,
  _getPrivateContactsPubkeys
);

export const getLeftPaneLists = createSelector(getSortedConversations, _getLeftPaneLists);

export const getMe = createSelector(
  [getConversationLookup, getOurNumber],
  (lookup: ConversationLookupType, ourNumber: string): ReduxConversationType => {
    return lookup[ourNumber];
  }
);

export const getDirectContacts = createSelector(
  getLeftPaneLists,
  (state: {
    conversations: Array<ReduxConversationType>;
    contacts: Array<ReduxConversationType>;
    unreadCount: number;
  }) => state.contacts
);

export const getUnreadMessageCount = createSelector(getLeftPaneLists, (state): number => {
  return state.unreadCount;
});

export const getConversationHeaderTitleProps = createSelector(getSelectedConversation, (state):
  | ConversationHeaderTitleProps
  | undefined => {
  if (!state) {
    return undefined;
  }
  return {
    isKickedFromGroup: !!state.isKickedFromGroup,
    conversationKey: state.id,
    isMe: !!state.isMe,
    members: state.members || [],
    isPublic: !!state.isPublic,
    profileName: state.profileName,
    name: state.name,
    subscriberCount: state.subscriberCount,
    isGroup: state.type === 'group',
    currentNotificationSetting: state.currentNotificationSetting,
  };
});

/**
 * Returns the formatted text for notification setting.
 */
export const getCurrentNotificationSettingText = createSelector(getSelectedConversation, (state):
  | string
  | undefined => {
  if (!state) {
    return undefined;
  }
  switch (state.currentNotificationSetting) {
    case 'all':
      return window.i18n('notificationForConvo_all');
    case 'mentions_only':
      return window.i18n('notificationForConvo_mentions_only');
    case 'disabled':
      return window.i18n('notificationForConvo_disabled');
    default:
      return window.i18n('notificationForConvo_all');
  }
});

export const getIsSelectedPrivate = createSelector(
  getSelectedConversation,
  (selectedProps): boolean => {
    return selectedProps?.isPrivate || false;
  }
);

export const getIsSelectedBlocked = createSelector(
  getSelectedConversation,
  (selectedProps): boolean => {
    return selectedProps?.isBlocked || false;
  }
);

export const getIsSelectedNoteToSelf = createSelector(
  getSelectedConversation,
  (selectedProps): boolean => {
    return selectedProps?.isMe || false;
  }
);

export const getNumberOfPinnedConversations = createSelector(getConversations, (state): number => {
  const values = Object.values(state.conversationLookup);
  return values.filter(conversation => conversation.isPinned).length;
});

export const isMessageDetailView = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => state.messageDetailProps !== undefined
);

export const getMessageDetailsViewProps = createSelector(
  getConversations,
  (state: ConversationsStateType): MessagePropsDetails | undefined => state.messageDetailProps
);

export const isRightPanelShowing = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => state.showRightPanel
);

export const isMessageSelectionMode = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => Boolean(state.selectedMessageIds.length > 0)
);

export const getSelectedMessageIds = createSelector(
  getConversations,
  (state: ConversationsStateType): Array<string> => state.selectedMessageIds
);

export const getLightBoxOptions = createSelector(
  getConversations,
  (state: ConversationsStateType): LightBoxOptions | undefined => state.lightBox
);

export const getQuotedMessage = createSelector(
  getConversations,
  (state: ConversationsStateType): ReplyingToMessageProps | undefined => state.quotedMessage
);

export const areMoreMessagesBeingFetched = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => state.areMoreMessagesBeingFetched || false
);

export const getShowScrollButton = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => state.showScrollButton || false
);

export const getQuotedMessageToAnimate = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => state.animateQuotedMessageId || undefined
);

export const getShouldHighlightMessage = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean =>
    Boolean(state.animateQuotedMessageId && state.shouldHighlightMessage)
);

export const getNextMessageToPlayId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => state.nextMessageToPlayId || undefined
);

export const getMentionsInput = createSelector(
  getConversations,
  (state: ConversationsStateType): MentionsMembersType => state.mentionMembers
);

/// Those calls are just related to ordering messages in the redux store.

function updateFirstMessageOfSeries(
  messageModelsProps: Array<MessageModelPropsWithoutConvoProps>
): Array<SortedMessageModelProps> {
  // messages are got from the more recent to the oldest, so we need to check if
  // the next messages in the list is still the same author.
  // The message is the first of the series if the next message is not from the same author
  const sortedMessageProps: Array<SortedMessageModelProps> = [];

  for (let i = 0; i < messageModelsProps.length; i++) {
    const currentSender = messageModelsProps[i].propsForMessage?.sender;
    // most recent message is at index 0, so the previous message sender is 1+index
    const previousSender =
      i < messageModelsProps.length - 1
        ? messageModelsProps[i + 1].propsForMessage?.sender
        : undefined;
    const nextSender = i > 0 ? messageModelsProps[i - 1].propsForMessage?.sender : undefined;
    // Handle firstMessageOfSeries for conditional avatar rendering

    sortedMessageProps.push({
      ...messageModelsProps[i],
      firstMessageOfSeries: !(i >= 0 && currentSender === previousSender),
      lastMessageOfSeries: currentSender !== nextSender,
    });
  }
  return sortedMessageProps;
}

function sortMessages(
  messages: Array<MessageModelPropsWithoutConvoProps>,
  isPublic: boolean
): Array<MessageModelPropsWithoutConvoProps> {
  // we order by serverTimestamp for public convos
  // be sure to update the sorting order to fetch messages from the DB too at getMessagesByConversation
  if (isPublic) {
    return messages.slice().sort((a, b) => {
      return (b.propsForMessage.serverTimestamp || 0) - (a.propsForMessage.serverTimestamp || 0);
    });
  }
  if (messages.some(n => !n.propsForMessage.timestamp && !n.propsForMessage.receivedAt)) {
    throw new Error('Found some messages without any timestamp set');
  }

  // for non public convos, we order by sent_at or received_at timestamp.
  // we assume that a message has either a sent_at or a received_at field set.
  const messagesSorted = messages
    .slice()
    .sort(
      (a, b) =>
        (b.propsForMessage.timestamp || b.propsForMessage.receivedAt || 0) -
        (a.propsForMessage.timestamp || a.propsForMessage.receivedAt || 0)
    );

  return messagesSorted;
}

/**
 * This returns the most recent message id in the database. This is not the most recent message shown,
 * but the most recent one, which could still not be loaded.
 */
export const getMostRecentMessageId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | null => {
    return state.mostRecentMessageId;
  }
);

export const getOldestMessageId = createSelector(
  getSortedMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): string | undefined => {
    const oldest =
      messages.length > 0 ? messages[messages.length - 1].propsForMessage.id : undefined;

    return oldest;
  }
);

export const getYoungestMessageId = createSelector(
  getSortedMessagesOfSelectedConversation,
  (messages: Array<MessageModelPropsWithoutConvoProps>): string | undefined => {
    const youngest = messages.length > 0 ? messages[0].propsForMessage.id : undefined;

    return youngest;
  }
);

export const getLoadedMessagesLength = createSelector(
  getConversations,
  (state: ConversationsStateType): number => {
    return state.messages.length || 0;
  }
);

export const isFirstUnreadMessageIdAbove = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    if (!state.firstUnreadMessageId) {
      return false;
    }

    const isNotPresent = !state.messages.some(
      m => m.propsForMessage.id === state.firstUnreadMessageId
    );

    return isNotPresent;
  }
);

const getMessageId = (_whatever: any, id: string) => id;

export const getMessagePropsByMessageId = createSelector(
  getConversations,
  getSortedMessagesOfSelectedConversation,
  getConversationLookup,
  getMessageId,
  (
    _convoState,
    messages: Array<SortedMessageModelProps>,
    conversations,
    id
  ): MessageModelPropsWithConvoProps | undefined => {
    const foundMessageProps: SortedMessageModelProps | undefined = messages?.find(
      m => m?.propsForMessage?.id === id
    );

    if (!foundMessageProps || !foundMessageProps.propsForMessage.convoId) {
      return undefined;
    }
    const sender = foundMessageProps?.propsForMessage?.sender;

    const foundMessageConversation = conversations[foundMessageProps.propsForMessage.convoId];
    if (!foundMessageConversation || !sender) {
      return undefined;
    }

    const foundSenderConversation = conversations[sender];
    if (!foundSenderConversation) {
      return undefined;
    }

    const ourPubkey = UserUtils.getOurPubKeyStrFromCache();
    const isGroup = !foundMessageConversation.isPrivate;
    const isPublic = foundMessageConversation.isPublic;

    const groupAdmins = (isGroup && foundMessageConversation.groupAdmins) || [];
    const weAreAdmin = groupAdmins.includes(ourPubkey) || false;
    // A message is deletable if
    // either we sent it,
    // or the convo is not a public one (in this case, we will only be able to delete for us)
    // or the convo is public and we are an admin
    const isDeletable = sender === ourPubkey || !isPublic || (isPublic && !!weAreAdmin);

    // A message is deletable for everyone if
    // either we sent it no matter what the conversation type,
    // or the convo is public and we are an admin
    const isDeletableForEveryone = sender === ourPubkey || (isPublic && !!weAreAdmin) || false;

    const isSenderAdmin = groupAdmins.includes(sender);
    const senderIsUs = sender === ourPubkey;

    const authorName = foundSenderConversation.name || null;
    const authorProfileName = senderIsUs ? window.i18n('you') : foundSenderConversation.profileName;

    const messageProps: MessageModelPropsWithConvoProps = {
      ...foundMessageProps,
      propsForMessage: {
        ...foundMessageProps.propsForMessage,
        isBlocked: !!foundMessageConversation.isBlocked,
        isPublic: !!isPublic,
        isOpenGroupV2: !!isPublic,
        isSenderAdmin,
        isDeletable,
        isDeletableForEveryone,
        weAreAdmin,
        conversationType: foundMessageConversation.type,
        sender,
        authorAvatarPath: foundSenderConversation.avatarPath || null,
        isKickedFromGroup: foundMessageConversation.isKickedFromGroup || false,
        authorProfileName: authorProfileName || 'Unknown',
        authorName,
      },
    };

    return messageProps;
  }
);

export const getMessageAvatarProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageAvatarSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const {
    authorAvatarPath,
    authorName,
    sender,
    authorProfileName,
    conversationType,
    direction,
    isPublic,
    isSenderAdmin,
  } = props.propsForMessage;

  const { lastMessageOfSeries } = props;

  const messageAvatarProps: MessageAvatarSelectorProps = {
    authorAvatarPath,
    authorName,
    sender,
    authorProfileName,
    conversationType,
    direction,
    isPublic,
    isSenderAdmin,
    lastMessageOfSeries,
  };

  return messageAvatarProps;
});

export const getMessagePreviewProps = createSelector(getMessagePropsByMessageId, (props):
  | MessagePreviewSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const { attachments, previews } = props.propsForMessage;

  const msgProps: MessagePreviewSelectorProps = {
    attachments,
    previews,
  };

  return msgProps;
});

export const getMessageQuoteProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageQuoteSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const { direction, quote } = props.propsForMessage;

  const msgProps: MessageQuoteSelectorProps = {
    direction,
    quote,
  };

  return msgProps;
});

export const getMessageStatusProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageStatusSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const { direction, status } = props.propsForMessage;

  const msgProps: MessageStatusSelectorProps = {
    direction,
    status,
  };

  return msgProps;
});

export const getMessageTextProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageTextSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const { direction, status, text, isDeleted, conversationType } = props.propsForMessage;

  const msgProps: MessageTextSelectorProps = {
    direction,
    status,
    text,
    isDeleted,
    conversationType,
  };

  return msgProps;
});

export const getMessageContextMenuProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageContextMenuSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const {
    attachments,
    sender,
    convoId,
    direction,
    status,
    isDeletable,
    isPublic,
    isOpenGroupV2,
    weAreAdmin,
    isSenderAdmin,
    text,
    serverTimestamp,
    timestamp,
    isBlocked,
    isDeletableForEveryone,
  } = props.propsForMessage;

  const msgProps: MessageContextMenuSelectorProps = {
    attachments,
    sender,
    convoId,
    direction,
    status,
    isDeletable,
    isPublic,
    isOpenGroupV2,
    weAreAdmin,
    isSenderAdmin,
    text,
    serverTimestamp,
    timestamp,
    isBlocked,
    isDeletableForEveryone,
  };

  return msgProps;
});

export const getMessageAuthorProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageAuthorSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const { authorName, sender, authorProfileName, direction } = props.propsForMessage;
  const { firstMessageOfSeries } = props;

  const msgProps: MessageAuthorSelectorProps = {
    authorName,
    sender,
    authorProfileName,
    direction,
    firstMessageOfSeries,
  };

  return msgProps;
});

export const getMessageIsDeletable = createSelector(
  getMessagePropsByMessageId,
  (props): boolean => {
    if (!props || _.isEmpty(props)) {
      return false;
    }

    return props.propsForMessage.isDeletable;
  }
);

export const getMessageAttachmentProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageAttachmentSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const {
    attachments,
    direction,
    isTrustedForAttachmentDownload,
    timestamp,
    serverTimestamp,
    sender,
    convoId,
  } = props.propsForMessage;
  const msgProps: MessageAttachmentSelectorProps = {
    attachments: attachments || [],
    direction,
    isTrustedForAttachmentDownload,
    timestamp,
    serverTimestamp,
    sender,
    convoId,
  };

  return msgProps;
});

export const getIsMessageSelected = createSelector(
  getMessagePropsByMessageId,
  getSelectedMessageIds,
  (props, selectedIds): boolean => {
    if (!props || _.isEmpty(props)) {
      return false;
    }

    const { id } = props.propsForMessage;

    return selectedIds.includes(id);
  }
);

export const getMessageContentSelectorProps = createSelector(getMessagePropsByMessageId, (props):
  | MessageContentSelectorProps
  | undefined => {
  if (!props || _.isEmpty(props)) {
    return undefined;
  }

  const {
    text,
    direction,
    timestamp,
    serverTimestamp,
    previews,
    attachments,
    quote,
  } = props.propsForMessage;

  const { firstMessageOfSeries, lastMessageOfSeries } = props;
  const msgProps: MessageContentSelectorProps = {
    direction,
    firstMessageOfSeries,
    lastMessageOfSeries,
    serverTimestamp,
    text,
    timestamp,
    previews,
    quote,
    attachments,
  };

  return msgProps;
});

export const getMessageContentWithStatusesSelectorProps = createSelector(
  getMessagePropsByMessageId,
  (props): MessageContentWithStatusSelectorProps | undefined => {
    if (!props || _.isEmpty(props)) {
      return undefined;
    }

    const {
      direction,
      isDeleted,
      attachments,
      isTrustedForAttachmentDownload,
    } = props.propsForMessage;

    const msgProps: MessageContentWithStatusSelectorProps = {
      direction,
      isDeleted,
      hasAttachments: Boolean(attachments?.length) || false,
      isTrustedForAttachmentDownload,
    };

    return msgProps;
  }
);

export const getGenericReadableMessageSelectorProps = createSelector(
  getMessagePropsByMessageId,
  (props): GenericReadableMessageSelectorProps | undefined => {
    if (!props || _.isEmpty(props)) {
      return undefined;
    }

    const {
      direction,
      conversationType,
      expirationLength,
      expirationTimestamp,
      isExpired,
      isUnread,
      receivedAt,
      isKickedFromGroup,
      isDeleted,
    } = props.propsForMessage;

    const msgProps: GenericReadableMessageSelectorProps = {
      direction,
      conversationType,
      expirationLength,
      expirationTimestamp,
      isUnread,
      isExpired,
      convoId: props.propsForMessage.convoId,
      receivedAt,
      isKickedFromGroup,
      isDeleted,
    };

    return msgProps;
  }
);

export const getOldTopMessageId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | null => state.oldTopMessageId || null
);

export const getOldBottomMessageId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | null => state.oldBottomMessageId || null
);
