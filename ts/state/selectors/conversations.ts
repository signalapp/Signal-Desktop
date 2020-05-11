import { createSelector } from 'reselect';
import { format } from '../../types/PhoneNumber';

import { LocalizerType } from '../../types/Util';
import { StateType } from '../reducer';
import {
  ConversationLookupType,
  ConversationsStateType,
  ConversationType,
} from '../ducks/conversations';

import {
  getPrimaryDeviceFor
} from '../../../js/modules/data';

import { getIntl, getRegionCode, getUserNumber } from './user';
import { PropsData as ConversationListItemPropsType } from '../../components/ConversationListItem';

export const getConversations = (state: StateType): ConversationsStateType =>
  state.conversations;

export const getConversationLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationLookup;
  }
);

export const getSelectedConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.selectedConversation;
  }
);

export const getShowArchived = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return Boolean(state.showArchived);
  }
);

function getConversationTitle(
  conversation: ConversationType,
  options: { i18n: LocalizerType; ourRegionCode: string }
): string {
  if (conversation.name) {
    return conversation.name;
  }

  if (conversation.type === 'group') {
    const { i18n } = options;

    return i18n('unknownGroup');
  }

  return format(conversation.phoneNumber, options);
}

const collator = new Intl.Collator();

export const _getConversationComparator = (
  i18n: LocalizerType,
  ourRegionCode: string
) => {
  return (left: ConversationType, right: ConversationType): number => {
    const leftTimestamp = left.timestamp;
    const rightTimestamp = right.timestamp;
    if (leftTimestamp && !rightTimestamp) {
      return -1;
    }
    if (rightTimestamp && !leftTimestamp) {
      return 1;
    }
    if (leftTimestamp && rightTimestamp && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    const leftTitle = getConversationTitle(left, {
      i18n,
      ourRegionCode,
    }).toLowerCase();
    const rightTitle = getConversationTitle(right, {
      i18n,
      ourRegionCode,
    }).toLowerCase();

    return collator.compare(leftTitle, rightTitle);
  };
};
export const getConversationComparator = createSelector(
  getIntl,
  getRegionCode,
  _getConversationComparator
);

export const _getLeftPaneLists = (
  lookup: ConversationLookupType,
  comparator: (left: ConversationType, right: ConversationType) => number,
  selectedConversation?: string
): {
  conversations: Array<ConversationType>;
  archivedConversations: Array<ConversationType>;
  friends: Array<ConversationType>;
  receivedFriendsRequest: Array<ConversationListItemPropsType>;
  sentFriendsRequest: Array<ConversationListItemPropsType>;
  unreadCount: number;
} => {
  const _ = window.Lodash;

  const values = Object.values(lookup);
  const sorted = values.sort(comparator);

  const conversations: Array<ConversationType> = [];
  const archivedConversations: Array<ConversationType> = [];
  const friends: Array<ConversationType> = [];
  const receivedFriendsRequest: Array<ConversationListItemPropsType> = [];
  const sentFriendsRequest: Array<ConversationListItemPropsType> = [];

  const max = sorted.length;
  let unreadCount = 0;

  // Map pubkeys to their primary pubkey so you don't need to call getPrimaryDeviceFor
  // every time.

  const filterToPrimary = async (conversation: ConversationType, filerGroup: Array<ConversationType | ConversationListItemPropsType>) => {
    // Used to ensure that only the primary device gets added  to LeftPane filtered groups
    // Get one result per user. Dont just ignore secondaries, in case
    // a user hasn't synced with primary but FR or contact is duplicated.

    const primaryPubkey = conversation.isSecondary
      ? await getPrimaryDeviceFor(conversation.id)
      : conversation.id;

    const primaryConversation = conversation.isSecondary
      ? conversations.find(c => c.id === primaryPubkey)
      : conversation;

    if (!_.includes(filerGroup, primaryConversation)) {
      // Push secondary to array only if private pubkey not found
      filerGroup.push(primaryConversation || conversation);
    }

    return primaryConversation;
  };

  for (let i = 0; i < max; i += 1) {
    let conversation = sorted[i];

    if (selectedConversation === conversation.id) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    if (conversation.isFriend && conversation.activeAt !== undefined) {
      void filterToPrimary(conversation, friends);
    }

    if (conversation.hasReceivedFriendRequest) {
      void filterToPrimary(conversation, receivedFriendsRequest);
    } else if (
      unreadCount < 9 &&
      conversation.isFriend &&
      conversation.unreadCount > 0
    ) {
      unreadCount += conversation.unreadCount;
    }
    if (conversation.hasSentFriendRequest) {
      void filterToPrimary(conversation, sentFriendsRequest);
    }

    if (!conversation.activeAt) {
      continue;
    }

    if (conversation.isArchived) {
      archivedConversations.push(conversation);
    } else {
      conversations.push(conversation);
    }
  }

  return {
    conversations,
    archivedConversations,
    friends,
    receivedFriendsRequest,
    sentFriendsRequest,
    unreadCount,
  };
};

export const getLeftPaneLists = createSelector(
  getConversationLookup,
  getConversationComparator,
  getSelectedConversation,
  _getLeftPaneLists
);

export const getMe = createSelector(
  [getConversationLookup, getUserNumber],
  (lookup: ConversationLookupType, ourNumber: string): ConversationType => {
    return lookup[ourNumber];
  }
);
