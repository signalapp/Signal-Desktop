// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { fromPairs, isNumber, isString } from 'lodash';
import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  ComposerStep,
  ConversationLookupType,
  ConversationMessageType,
  ConversationsStateType,
  ConversationType,
  MessageLookupType,
  MessagesByConversationType,
  MessageType,
  OneTimeModalState,
  PreJoinConversationType,
} from '../ducks/conversations';
import { LocalizerType } from '../../types/Util';
import { getOwn } from '../../util/getOwn';
import { deconstructLookup } from '../../util/deconstructLookup';
import type { CallsByConversationType } from '../ducks/calling';
import { getCallsByConversation } from './calling';
import { getBubbleProps } from '../../shims/Whisper';
import { PropsDataType as TimelinePropsType } from '../../components/conversation/Timeline';
import { TimelineItemType } from '../../components/conversation/TimelineItem';
import { assert } from '../../util/assert';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { filterAndSortContacts } from '../../util/filterAndSortContacts';

import {
  getInteractionMode,
  getIntl,
  getRegionCode,
  getUserConversationId,
  getUserNumber,
} from './user';
import { getPinnedConversationIds } from './items';

let placeholderContact: ConversationType;
export const getPlaceholderContact = (): ConversationType => {
  if (placeholderContact) {
    return placeholderContact;
  }

  placeholderContact = {
    id: 'placeholder-contact',
    type: 'direct',
    title: window.i18n('unknownContact'),
  };
  return placeholderContact;
};

export const getConversations = (state: StateType): ConversationsStateType =>
  state.conversations;

export const getPreJoinConversation = createSelector(
  getConversations,
  (state: ConversationsStateType): PreJoinConversationType | undefined => {
    return state.preJoinConversation;
  }
);
export const getConversationLookup = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationLookup;
  }
);

export const getConversationsByUuid = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByUuid;
  }
);

export const getConversationsByE164 = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByE164;
  }
);

export const getConversationsByGroupId = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByGroupId;
  }
);

export const getSelectedConversationId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.selectedConversationId;
  }
);

export const getSelectedConversation = createSelector(
  getSelectedConversationId,
  getConversationLookup,
  (
    selectedConversationId: string | undefined,
    conversationLookup: ConversationLookupType
  ): undefined | ConversationType => {
    if (!selectedConversationId) {
      return undefined;
    }
    const conversation = getOwn(conversationLookup, selectedConversationId);
    assert(
      conversation,
      'getSelectedConversation: could not find selected conversation in lookup; returning undefined'
    );
    return conversation;
  }
);

type SelectedMessageType = {
  id: string;
  counter: number;
};
export const getSelectedMessage = createSelector(
  getConversations,
  (state: ConversationsStateType): SelectedMessageType | undefined => {
    if (!state.selectedMessage) {
      return undefined;
    }

    return {
      id: state.selectedMessage,
      counter: state.selectedMessageCounter,
    };
  }
);

export const getShowArchived = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return Boolean(state.showArchived);
  }
);

const getComposerState = createSelector(
  getConversations,
  (state: ConversationsStateType) => state.composer
);

export const getComposerStep = createSelector(
  getComposerState,
  (composerState): undefined | ComposerStep => composerState?.step
);

export const hasGroupCreationError = createSelector(
  getComposerState,
  (composerState): boolean => {
    if (composerState?.step === ComposerStep.SetGroupMetadata) {
      return composerState.hasError;
    }
    return false;
  }
);

export const isCreatingGroup = createSelector(
  getComposerState,
  (composerState): boolean =>
    composerState?.step === ComposerStep.SetGroupMetadata &&
    composerState.isCreating
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

const collator = new Intl.Collator();

// Note: we will probably want to put i18n and regionCode back when we are formatting
//   phone numbers and contacts from scratch here again.
export const _getConversationComparator = () => {
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

    if (
      typeof left.inboxPosition === 'number' &&
      typeof right.inboxPosition === 'number'
    ) {
      return right.inboxPosition > left.inboxPosition ? -1 : 1;
    }

    if (typeof left.inboxPosition === 'number' && right.inboxPosition == null) {
      return -1;
    }

    if (typeof right.inboxPosition === 'number' && left.inboxPosition == null) {
      return 1;
    }

    return collator.compare(left.title, right.title);
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
  selectedConversation?: string,
  pinnedConversationIds?: Array<string>
): {
  conversations: Array<ConversationType>;
  archivedConversations: Array<ConversationType>;
  pinnedConversations: Array<ConversationType>;
} => {
  const conversations: Array<ConversationType> = [];
  const archivedConversations: Array<ConversationType> = [];
  const pinnedConversations: Array<ConversationType> = [];

  const values = Object.values(lookup);
  const max = values.length;
  for (let i = 0; i < max; i += 1) {
    let conversation = values[i];
    if (conversation.activeAt) {
      if (selectedConversation === conversation.id) {
        conversation = {
          ...conversation,
          isSelected: true,
        };
      }

      if (conversation.isArchived) {
        archivedConversations.push(conversation);
      } else if (conversation.isPinned) {
        pinnedConversations.push(conversation);
      } else {
        conversations.push(conversation);
      }
    }
  }

  conversations.sort(comparator);
  archivedConversations.sort(comparator);

  pinnedConversations.sort(
    (a, b) =>
      (pinnedConversationIds || []).indexOf(a.id) -
      (pinnedConversationIds || []).indexOf(b.id)
  );

  return { conversations, archivedConversations, pinnedConversations };
};

export const getLeftPaneLists = createSelector(
  getConversationLookup,
  getConversationComparator,
  getSelectedConversationId,
  getPinnedConversationIds,
  _getLeftPaneLists
);

export const getMaximumGroupSizeModalState = createSelector(
  getComposerState,
  (composerState): OneTimeModalState => {
    switch (composerState?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return composerState.maximumGroupSizeModalState;
      default:
        assert(
          false,
          'Can\'t get the maximum group size modal state in this composer state; returning "never shown"'
        );
        return OneTimeModalState.NeverShown;
    }
  }
);

export const getRecommendedGroupSizeModalState = createSelector(
  getComposerState,
  (composerState): OneTimeModalState => {
    switch (composerState?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return composerState.recommendedGroupSizeModalState;
      default:
        assert(
          false,
          'Can\'t get the recommended group size modal state in this composer state; returning "never shown"'
        );
        return OneTimeModalState.NeverShown;
    }
  }
);

export const getMe = createSelector(
  [getConversationLookup, getUserConversationId],
  (
    lookup: ConversationLookupType,
    ourConversationId: string
  ): ConversationType => {
    return lookup[ourConversationId];
  }
);

export const getComposerContactSearchTerm = createSelector(
  getComposerState,
  (composer): string => {
    if (!composer) {
      assert(false, 'getComposerContactSearchTerm: composer is not open');
      return '';
    }
    if (composer.step === ComposerStep.SetGroupMetadata) {
      assert(
        false,
        'getComposerContactSearchTerm: composer does not have a search term'
      );
      return '';
    }
    return composer.contactSearchTerm;
  }
);

/**
 * This returns contacts for the composer and group members, which isn't just your primary
 * system contacts. It may include false positives, which is better than missing contacts.
 *
 * Because it filters unregistered contacts and that's (partially) determined by the
 * current time, it's possible for this to return stale contacts that have unregistered
 * if no other conversations change. This should be a rare false positive.
 */
export const getContacts = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      contact =>
        contact.type === 'direct' &&
        !contact.isMe &&
        !contact.isBlocked &&
        !isConversationUnregistered(contact) &&
        (isString(contact.name) || contact.profileSharing)
    )
);

const getNormalizedComposerContactSearchTerm = createSelector(
  getComposerContactSearchTerm,
  (searchTerm: string): string => searchTerm.trim()
);

const getNoteToSelfTitle = createSelector(getIntl, (i18n: LocalizerType) =>
  i18n('noteToSelf').toLowerCase()
);

export const getComposeContacts = createSelector(
  getNormalizedComposerContactSearchTerm,
  getContacts,
  getMe,
  getNoteToSelfTitle,
  (
    searchTerm: string,
    contacts: Array<ConversationType>,
    noteToSelf: ConversationType,
    noteToSelfTitle: string
  ): Array<ConversationType> => {
    const result: Array<ConversationType> = filterAndSortContacts(
      contacts,
      searchTerm
    );
    if (!searchTerm || noteToSelfTitle.includes(searchTerm)) {
      result.push(noteToSelf);
    }
    return result;
  }
);

export const getCandidateContactsForNewGroup = createSelector(
  getContacts,
  getNormalizedComposerContactSearchTerm,
  filterAndSortContacts
);

export const getCantAddContactForModal = createSelector(
  getConversationLookup,
  getComposerState,
  (conversationLookup, composerState): undefined | ConversationType => {
    if (composerState?.step !== ComposerStep.ChooseGroupMembers) {
      return undefined;
    }

    const conversationId = composerState.cantAddContactIdForModal;
    if (!conversationId) {
      return undefined;
    }

    const result = getOwn(conversationLookup, conversationId);
    assert(
      result,
      'getCantAddContactForModal: failed to look up conversation by ID; returning undefined'
    );
    return result;
  }
);

const getGroupCreationComposerState = createSelector(
  getComposerState,
  (
    composerState
  ): {
    groupName: string;
    groupAvatar: undefined | ArrayBuffer;
    selectedConversationIds: Array<string>;
  } => {
    switch (composerState?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return composerState;
      default:
        assert(
          false,
          'getSetGroupMetadataComposerState: expected step to be SetGroupMetadata'
        );
        return {
          groupName: '',
          groupAvatar: undefined,
          selectedConversationIds: [],
        };
    }
  }
);

export const getComposeGroupAvatar = createSelector(
  getGroupCreationComposerState,
  (composerState): undefined | ArrayBuffer => composerState.groupAvatar
);

export const getComposeGroupName = createSelector(
  getGroupCreationComposerState,
  (composerState): string => composerState.groupName
);

export const getComposeSelectedContacts = createSelector(
  getConversationLookup,
  getGroupCreationComposerState,
  (conversationLookup, composerState): Array<ConversationType> =>
    deconstructLookup(conversationLookup, composerState.selectedConversationIds)
);

// This is where we will put Conversation selector logic, replicating what
// is currently in models/conversation.getProps()
// What needs to happen to pull that selector logic here?
//   1) contactTypingTimers - that UI-only state needs to be moved to redux
//   2) all of the message selectors need to be reselect-based; today those
//      Backbone-based prop-generation functions expect to get Conversation information
//      directly via ConversationController
export function _conversationSelector(
  conversation?: ConversationType
  // regionCode: string,
  // userNumber: string
): ConversationType {
  if (conversation) {
    return conversation;
  }

  return getPlaceholderContact();
}

// A little optimization to reset our selector cache when high-level application data
//   changes: regionCode and userNumber.
type CachedConversationSelectorType = (
  conversation?: ConversationType
) => ConversationType;
export const getCachedSelectorForConversation = createSelector(
  getRegionCode,
  getUserNumber,
  (): CachedConversationSelectorType => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(_conversationSelector, { max: 2000 });
  }
);

export type GetConversationByIdType = (id?: string) => ConversationType;
export const getConversationSelector = createSelector(
  getCachedSelectorForConversation,
  getConversationLookup,
  getConversationsByUuid,
  getConversationsByE164,
  getConversationsByGroupId,
  (
    selector: CachedConversationSelectorType,
    byId: ConversationLookupType,
    byUuid: ConversationLookupType,
    byE164: ConversationLookupType,
    byGroupId: ConversationLookupType
  ): GetConversationByIdType => {
    return (id?: string) => {
      if (!id) {
        window.log.warn(
          `getConversationSelector: Called with a falsey id ${id}`
        );
        // This will return a placeholder contact
        return selector(undefined);
      }

      const onE164 = getOwn(byE164, id);
      if (onE164) {
        return selector(onE164);
      }
      const onUuid = getOwn(byUuid, id.toLowerCase ? id.toLowerCase() : id);
      if (onUuid) {
        return selector(onUuid);
      }
      const onGroupId = getOwn(byGroupId, id);
      if (onGroupId) {
        return selector(onGroupId);
      }
      const onId = getOwn(byId, id);
      if (onId) {
        return selector(onId);
      }

      window.log.warn(
        `getConversationSelector: No conversation found for id ${id}`
      );
      // This will return a placeholder contact
      return selector(undefined);
    };
  }
);

// For now we use a shim, as selector logic is still happening in the Backbone Model.
// What needs to happen to pull that selector logic here?
//   1) translate ~500 lines of selector logic into TypeScript
//   2) other places still rely on that prop-gen code - need to put these under Roots:
//     - quote compose
//     - message details
export function _messageSelector(
  message: MessageType,
  _ourNumber: string,
  _regionCode: string,
  interactionMode: 'mouse' | 'keyboard',
  _getConversationById: GetConversationByIdType,
  _callsByConversation: CallsByConversationType,
  selectedMessageId?: string,
  selectedMessageCounter?: number
): TimelineItemType {
  // Note: We don't use all of those parameters here, but the shim we call does.
  //   We want to call this function again if any of those parameters change.
  const props = getBubbleProps(message);

  if (selectedMessageId === message.id) {
    return {
      ...props,
      data: {
        ...props.data,
        interactionMode,
        isSelected: true,
        isSelectedCounter: selectedMessageCounter,
      },
    };
  }

  return {
    ...props,
    data: {
      ...props.data,
      interactionMode,
    },
  };
}

// A little optimization to reset our selector cache whenever high-level application data
//   changes: regionCode and userNumber.
type CachedMessageSelectorType = (
  message: MessageType,
  ourNumber: string,
  regionCode: string,
  interactionMode: 'mouse' | 'keyboard',
  getConversationById: GetConversationByIdType,
  callsByConversation: CallsByConversationType,
  selectedMessageId?: string,
  selectedMessageCounter?: number
) => TimelineItemType;
export const getCachedSelectorForMessage = createSelector(
  getRegionCode,
  getUserNumber,
  (): CachedMessageSelectorType => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(_messageSelector, { max: 2000 });
  }
);

type GetMessageByIdType = (id: string) => TimelineItemType | undefined;
export const getMessageSelector = createSelector(
  getCachedSelectorForMessage,
  getMessages,
  getSelectedMessage,
  getConversationSelector,
  getRegionCode,
  getUserNumber,
  getInteractionMode,
  getCallsByConversation,
  (
    messageSelector: CachedMessageSelectorType,
    messageLookup: MessageLookupType,
    selectedMessage: SelectedMessageType | undefined,
    conversationSelector: GetConversationByIdType,
    regionCode: string,
    ourNumber: string,
    interactionMode: 'keyboard' | 'mouse',
    callsByConversation: CallsByConversationType
  ): GetMessageByIdType => {
    return (id: string) => {
      const message = messageLookup[id];
      if (!message) {
        return undefined;
      }

      return messageSelector(
        message,
        ourNumber,
        regionCode,
        interactionMode,
        conversationSelector,
        callsByConversation,
        selectedMessage ? selectedMessage.id : undefined,
        selectedMessage ? selectedMessage.counter : undefined
      );
    };
  }
);

export function _conversationMessagesSelector(
  conversation: ConversationMessageType
): TimelinePropsType {
  const {
    heightChangeMessageIds,
    isLoadingMessages,
    isNearBottom,
    loadCountdownStart,
    messageIds,
    metrics,
    resetCounter,
    scrollToMessageId,
    scrollToMessageCounter,
  } = conversation;

  const firstId = messageIds[0];
  const lastId =
    messageIds.length === 0 ? undefined : messageIds[messageIds.length - 1];

  const { oldestUnread } = metrics;

  const haveNewest = !metrics.newest || !lastId || lastId === metrics.newest.id;
  const haveOldest =
    !metrics.oldest || !firstId || firstId === metrics.oldest.id;

  const items = messageIds;

  const messageHeightChangeLookup =
    heightChangeMessageIds && heightChangeMessageIds.length
      ? fromPairs(heightChangeMessageIds.map(id => [id, true]))
      : null;
  const messageHeightChangeIndex = messageHeightChangeLookup
    ? messageIds.findIndex(id => messageHeightChangeLookup[id])
    : undefined;

  const oldestUnreadIndex = oldestUnread
    ? messageIds.findIndex(id => id === oldestUnread.id)
    : undefined;
  const scrollToIndex = scrollToMessageId
    ? messageIds.findIndex(id => id === scrollToMessageId)
    : undefined;
  const { totalUnread } = metrics;

  return {
    haveNewest,
    haveOldest,
    isLoadingMessages,
    loadCountdownStart,
    items,
    isNearBottom,
    messageHeightChangeIndex:
      isNumber(messageHeightChangeIndex) && messageHeightChangeIndex >= 0
        ? messageHeightChangeIndex
        : undefined,
    oldestUnreadIndex:
      isNumber(oldestUnreadIndex) && oldestUnreadIndex >= 0
        ? oldestUnreadIndex
        : undefined,
    resetCounter,
    scrollToIndex:
      isNumber(scrollToIndex) && scrollToIndex >= 0 ? scrollToIndex : undefined,
    scrollToIndexCounter: scrollToMessageCounter,
    totalUnread,
  };
}

type CachedConversationMessagesSelectorType = (
  conversation: ConversationMessageType
) => TimelinePropsType;
export const getCachedSelectorForConversationMessages = createSelector(
  getRegionCode,
  getUserNumber,
  (): CachedConversationMessagesSelectorType => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(_conversationMessagesSelector, { max: 50 });
  }
);

export const getConversationMessagesSelector = createSelector(
  getCachedSelectorForConversationMessages,
  getMessagesByConversation,
  (
    conversationMessagesSelector: CachedConversationMessagesSelectorType,
    messagesByConversation: MessagesByConversationType
  ) => {
    return (id: string): TimelinePropsType | undefined => {
      const conversation = messagesByConversation[id];
      if (!conversation) {
        return undefined;
      }

      return conversationMessagesSelector(conversation);
    };
  }
);

export const getInvitedContactsForNewlyCreatedGroup = createSelector(
  getConversationLookup,
  getConversations,
  (
    conversationLookup,
    { invitedConversationIdsForNewlyCreatedGroup = [] }
  ): Array<ConversationType> =>
    deconstructLookup(
      conversationLookup,
      invitedConversationIdsForNewlyCreatedGroup
    )
);
