import { createSelector } from 'reselect';
import { format } from '../../types/PhoneNumber';

import { LocalizerType } from '../../types/Util';
import { StateType } from '../reducer';
import {
  ConversationLookupType,
  ConversationsStateType,
  ConversationType,
} from '../ducks/conversations';

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
  const values = Object.values(lookup);
  const sorted = values.sort(comparator);

  const conversations: Array<ConversationType> = [];
  const archivedConversations: Array<ConversationType> = [];
  const allFriends: Array<ConversationType> = [];
  const allReceivedFriendsRequest: Array<ConversationListItemPropsType> = [];
  const allSentFriendsRequest: Array<ConversationListItemPropsType> = [];

  const max = sorted.length;
  let unreadCount = 0;

  for (let i = 0; i < max; i += 1) {
    let conversation = sorted[i];

    if (selectedConversation === conversation.id) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    if (conversation.isFriend && conversation.activeAt !== undefined) {
      allFriends.push(conversation);
    }

    if (conversation.hasReceivedFriendRequest) {
      allReceivedFriendsRequest.push(conversation);
    } else if (
      unreadCount < 9 &&
      conversation.isFriend &&
      conversation.unreadCount > 0
    ) {
      unreadCount += conversation.unreadCount;
    }
    if (conversation.hasSentFriendRequest) {
      allSentFriendsRequest.push(conversation);
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

  const filterToPrimary = (
    group: Array<ConversationType | ConversationListItemPropsType>
  ) => {
    // Used to ensure that only the primary device gets added to LeftPane filtered groups

    const constructedGroup = conversations.filter(c =>
      group.some(g => c.id === g.id)
    );
    // tslint:disable-next-line: no-unnecessary-local-variable
    const filteredGroup = constructedGroup.filter(
      (c, idx) =>
        !(
          c.isSecondary &&
          constructedGroup.some(
            g => !g.isSecondary && g.id === constructedGroup[idx].primaryDevice
          )
        )
    );

    return filteredGroup;
  };

  const friends = filterToPrimary(allFriends);
  const receivedFriendsRequest = filterToPrimary(allReceivedFriendsRequest);
  const sentFriendsRequest = filterToPrimary(allSentFriendsRequest);

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
