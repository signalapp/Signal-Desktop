import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  ConversationLookupType,
  ConversationsStateType,
  MentionsMembersType,
  MessageModelProps,
  MessagePropsDetails,
  ReduxConversationType,
  SortedMessageModelProps,
} from '../ducks/conversations';

import { getIntl, getOurNumber } from './user';
import { BlockedNumberController } from '../../util';
import { ConversationTypeEnum } from '../../models/conversation';
import { LocalizerType } from '../../types/Util';
import {
  ConversationHeaderProps,
  ConversationHeaderTitleProps,
} from '../../components/conversation/ConversationHeader';
import { LightBoxOptions } from '../../components/session/conversation/SessionConversation';
import { ReplyingToMessageProps } from '../../components/session/conversation/SessionCompositionBox';
import { createSlice } from '@reduxjs/toolkit';
import { getConversationController } from '../../session/conversations';

export const getConversations = (state: StateType): ConversationsStateType => state.conversations;

export const getConversationLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationLookup;
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

export const getOurPrimaryConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): ReduxConversationType =>
    state.conversationLookup[window.storage.get('primaryDevicePubKey')]
);

const getMessagesOfSelectedConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): Array<MessageModelProps> => state.messages
);

// Redux recommends to do filtered and deriving state in a selector rather than ourself
export const getSortedMessagesOfSelectedConversation = createSelector(
  getMessagesOfSelectedConversation,
  (messages: Array<MessageModelProps>): Array<SortedMessageModelProps> => {
    if (messages.length === 0) {
      return [];
    }

    const convoId = messages[0].propsForMessage.convoId;
    const convo = getConversationController().get(convoId);

    if (!convo) {
      return [];
    }

    const isPublic = convo.isPublic() || false;
    const isPrivate = convo.isPrivate() || false;
    const sortedMessage = sortMessages(messages, isPublic);

    return updateFirstMessageOfSeries(sortedMessage, { isPublic, isPrivate });
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
export const _getLeftPaneLists = (
  lookup: ConversationLookupType,
  comparator: (left: ReduxConversationType, right: ReduxConversationType) => number,
  selectedConversation?: string
): {
  conversations: Array<ReduxConversationType>;
  contacts: Array<ReduxConversationType>;
  unreadCount: number;
} => {
  const values = Object.values(lookup);
  const sorted = values.sort(comparator);

  const conversations: Array<ReduxConversationType> = [];
  const directConversations: Array<ReduxConversationType> = [];

  let index = 0;

  let unreadCount = 0;
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

    if (conversation.activeAt !== undefined && conversation.type === ConversationTypeEnum.PRIVATE) {
      directConversations.push(conversation);
    }

    if (unreadCount < 9 && conversation.unreadCount > 0) {
      unreadCount += conversation.unreadCount;
    }

    conversations.push(conversation);
    index++;
  }

  return {
    conversations,
    contacts: directConversations,
    unreadCount,
  };
};

export const getLeftPaneLists = createSelector(
  getConversationLookup,
  getConversationComparator,
  getSelectedConversationKey,
  _getLeftPaneLists
);

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
    isKickedFromGroup: state.isKickedFromGroup,
    phoneNumber: state.phoneNumber,
    isMe: state.isMe,
    members: state.members || [],
    isPublic: state.isPublic,
    profileName: state.profileName,
    name: state.name,
    subscriberCount: state.subscriberCount,
    isGroup: state.type === 'group',
  };
});

export const getConversationHeaderProps = createSelector(getSelectedConversation, (state):
  | ConversationHeaderProps
  | undefined => {
  if (!state) {
    return undefined;
  }

  const expirationSettingName = state.expireTimer
    ? window.Whisper.ExpirationTimerOptions.getName(state.expireTimer || 0)
    : null;

  return {
    id: state.id,
    isPrivate: state.isPrivate,
    notificationForConvo: state.notificationForConvo,
    currentNotificationSetting: state.currentNotificationSetting,
    isBlocked: state.isBlocked,
    left: state.left,
    avatarPath: state.avatarPath,
    expirationSettingName: expirationSettingName,
    hasNickname: state.hasNickname,
    weAreAdmin: state.weAreAdmin,
    isKickedFromGroup: state.isKickedFromGroup,
    phoneNumber: state.phoneNumber,
    isMe: state.isMe,
    members: state.members || [],
    isPublic: state.isPublic,
    profileName: state.profileName,
    name: state.name,
    subscriberCount: state.subscriberCount,
    isGroup: state.isGroup,
  };
});

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
  (state: ConversationsStateType): boolean => state.selectedMessageIds.length > 0
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

export const getNextMessageToPlayIndex = createSelector(
  getConversations,
  (state: ConversationsStateType): number | undefined => state.nextMessageToPlay || undefined
);

export const getMentionsInput = createSelector(
  getConversations,
  (state: ConversationsStateType): MentionsMembersType => state.mentionMembers
);

/// Those calls are just related to ordering messages in the redux store.

function updateFirstMessageOfSeries(
  messageModelsProps: Array<MessageModelProps>,
  convoOpts: { isPrivate: boolean; isPublic: boolean }
): Array<SortedMessageModelProps> {
  // messages are got from the more recent to the oldest, so we need to check if
  // the next messages in the list is still the same author.
  // The message is the first of the series if the next message is not from the same author
  const sortedMessageProps: Array<SortedMessageModelProps> = [];

  if (convoOpts.isPrivate) {
    // we don't really care do do that logic for private chats
    return messageModelsProps.map(p => {
      return { ...p, firstMessageOfSeries: true };
    });
  }

  for (let i = 0; i < messageModelsProps.length; i++) {
    const currentSender = messageModelsProps[i].propsForMessage?.authorPhoneNumber;
    const nextSender =
      i < messageModelsProps.length - 1
        ? messageModelsProps[i + 1].propsForMessage?.authorPhoneNumber
        : undefined;

    // Handle firstMessageOfSeries for conditional avatar rendering

    if (i >= 0 && currentSender === nextSender) {
      sortedMessageProps.push({ ...messageModelsProps[i], firstMessageOfSeries: false });
    } else {
      sortedMessageProps.push({ ...messageModelsProps[i], firstMessageOfSeries: true });
    }
  }
  return sortedMessageProps;
}

function sortMessages(
  messages: Array<MessageModelProps>,
  isPublic: boolean
): Array<MessageModelProps> {
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
  const messagesSorted = messages.sort(
    (a, b) =>
      (b.propsForMessage.timestamp || b.propsForMessage.receivedAt || 0) -
      (a.propsForMessage.timestamp || a.propsForMessage.receivedAt || 0)
  );

  return messagesSorted;
}

function getFirstMessageUnreadIndex(messages: Array<MessageModelProps>) {
  if (!messages || messages.length === 0) {
    return -1;
  }

  // this is to handle the case where 50 messages are loaded, some of them are already read at the top, but some  not loaded yet are still unread.
  if (
    messages.length <
    getConversationController()
      .get(messages[0].propsForMessage.convoId)
      ?.get('unreadCount')
  ) {
    return -2;
  }

  // iterate over the incoming messages from the oldest one. the first one with isUnread !== undefined is our first unread
  for (let index = messages.length - 1; index > 0; index--) {
    const message = messages[index];
    if (
      message.propsForMessage.direction === 'incoming' &&
      message.propsForMessage.isUnread === true
    ) {
      return index;
    }
  }

  return -1;
}

export const getFirstUnreadMessageId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.firstUnreadMessageId;
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
