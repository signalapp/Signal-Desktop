import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  ConversationLookupType,
  ConversationsStateType,
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

export const getMessagesOfSelectedConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): Array<SortedMessageModelProps> => state.messages
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

    // Show loading icon while fetching messages
    if (conversation.isPublic && !conversation.activeAt) {
      conversation.lastMessage = {
        status: 'sending',
        text: '',
      };
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
