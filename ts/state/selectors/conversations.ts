import memoizee from 'memoizee';
import { createSelector } from 'reselect';
import { format } from '../../types/PhoneNumber';

import { LocalizerType } from '../../types/Util';
import { StateType } from '../reducer';
import {
  ConversationLookupType,
  ConversationsStateType,
  ConversationType,
  MessageLookupType,
  MessagesByConversationType,
  MessageType,
} from '../ducks/conversations';

import { getIntl, getRegionCode, getUserNumber } from './user';

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

export const getMessages = createSelector(
  getConversations,
  (state: ConversationsStateType): MessageLookupType => {
    return state.messagesLookup;
  }
);
export const getMessagesByConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): MessagesByConversationType => {
    return state.messagesByConversation;
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
    });
    const rightTitle = getConversationTitle(right, {
      i18n,
      ourRegionCode,
    });

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
} => {
  const conversations: Array<ConversationType> = [];
  const archivedConversations: Array<ConversationType> = [];

  const values = Object.values(lookup);
  const max = values.length;
  for (let i = 0; i < max; i += 1) {
    let conversation = values[i];
    if (!conversation.activeAt) {
      continue;
    }

    if (selectedConversation === conversation.id) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    if (conversation.isArchived) {
      archivedConversations.push(conversation);
    } else {
      conversations.push(conversation);
    }
  }

  conversations.sort(comparator);
  archivedConversations.sort(comparator);

  return { conversations, archivedConversations };
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

// This is where we will put Conversation selector logic, replicating what
//   is currently in models/conversation.getProps()
//   Blockers:
//     1) contactTypingTimers - that UI-only state needs to be moved to redux
export function _conversationSelector(
  conversation: ConversationType
  // regionCode: string,
  // userNumber: string
): ConversationType {
  return conversation;
}

// A little optimization to reset our selector cache when high-level application data
//   changes: regionCode and userNumber.
type CachedConversationSelectorType = (
  conversation: ConversationType
) => ConversationType;
export const getCachedSelectorForConversation = createSelector(
  getRegionCode,
  getUserNumber,
  (): CachedConversationSelectorType => {
    return memoizee(_conversationSelector, { max: 100 });
  }
);

type GetConversationByIdType = (id: string) => ConversationType | undefined;
export const getConversationSelector = createSelector(
  getCachedSelectorForConversation,
  getConversationLookup,
  (
    selector: CachedConversationSelectorType,
    lookup: ConversationLookupType
  ): GetConversationByIdType => {
    return (id: string) => {
      const conversation = lookup[id];
      if (!conversation) {
        return;
      }

      return selector(conversation);
    };
  }
);

// For now we pass through, as selector logic is still happening in the Backbone Model.
//   Blockers:
//     1) it's a lot of code to pull over - ~500 lines
//     2) a couple places still rely on all that code - will need to move these to Roots:
//       - quote compose
//       - message details
export function _messageSelector(
  message: MessageType
  // ourNumber: string,
  // regionCode: string,
  // conversation?: ConversationType,
  // sender?: ConversationType,
  // quoted?: ConversationType
): MessageType {
  return message;
}

// A little optimization to reset our selector cache whenever high-level application data
//   changes: regionCode and userNumber.
type CachedMessageSelectorType = (message: MessageType) => MessageType;
export const getCachedSelectorForMessage = createSelector(
  getRegionCode,
  getUserNumber,
  (): CachedMessageSelectorType => {
    return memoizee(_messageSelector, { max: 500 });
  }
);

type GetMessageByIdType = (id: string) => MessageType | undefined;
export const getMessageSelector = createSelector(
  getCachedSelectorForMessage,
  getMessages,
  (
    selector: CachedMessageSelectorType,
    lookup: MessageLookupType
  ): GetMessageByIdType => {
    return (id: string) => {
      const message = lookup[id];
      if (!message) {
        return;
      }

      return selector(message);
    };
  }
);
