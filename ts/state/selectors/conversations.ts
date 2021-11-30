// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { fromPairs, isNumber } from 'lodash';
import { createSelector } from 'reselect';

import type { StateType } from '../reducer';

import type {
  ConversationLookupType,
  ConversationMessageType,
  ConversationsStateType,
  ConversationType,
  MessageLookupType,
  MessagesByConversationType,
  PreJoinConversationType,
} from '../ducks/conversations';
import type { UsernameSaveState } from '../ducks/conversationsEnums';
import { ComposerStep, OneTimeModalState } from '../ducks/conversationsEnums';
import { getOwn } from '../../util/getOwn';
import { isNotNil } from '../../util/isNotNil';
import { deconstructLookup } from '../../util/deconstructLookup';
import type { PropsDataType as TimelinePropsType } from '../../components/conversation/Timeline';
import type { TimelineItemType } from '../../components/conversation/TimelineItem';
import { assert } from '../../util/assert';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { filterAndSortConversationsByTitle } from '../../util/filterAndSortConversations';
import type { ContactNameColorType } from '../../types/Colors';
import { ContactNameColors } from '../../types/Colors';
import type { AvatarDataType } from '../../types/Avatar';
import type { UUIDStringType } from '../../types/UUID';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { sortByTitle } from '../../util/sortByTitle';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from '../../util/whatTypeOfConversation';

import {
  getIntl,
  getRegionCode,
  getUserConversationId,
  getUserNumber,
  getUserUuid,
} from './user';
import { getPinnedConversationIds } from './items';
import { getPropsForBubble } from './message';
import type { CallSelectorType, CallStateType } from './calling';
import { getActiveCall, getCallSelector } from './calling';
import type { AccountSelectorType } from './accounts';
import { getAccountSelector } from './accounts';
import * as log from '../../logging/log';

let placeholderContact: ConversationType;
export const getPlaceholderContact = (): ConversationType => {
  if (placeholderContact) {
    return placeholderContact;
  }

  placeholderContact = {
    acceptedMessageRequest: false,
    badges: [],
    id: 'placeholder-contact',
    type: 'direct',
    title: window.i18n('unknownContact'),
    isMe: false,
    sharedGroupNames: [],
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
export const getConversationsByUsername = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByUsername;
  }
);

const getAllConversations = createSelector(
  getConversationLookup,
  (lookup): Array<ConversationType> => Object.values(lookup)
);

export const getConversationsByTitleSelector = createSelector(
  getAllConversations,
  (conversations): ((title: string) => Array<ConversationType>) =>
    (title: string) =>
      conversations.filter(conversation => conversation.title === title)
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

export const getUsernameSaveState = createSelector(
  getConversations,
  (state: ConversationsStateType): UsernameSaveState => {
    return state.usernameSaveState;
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

export const isEditingAvatar = createSelector(
  getComposerState,
  (composerState): boolean =>
    composerState?.step === ComposerStep.SetGroupMetadata &&
    composerState.isEditingAvatar
);

export const getComposeAvatarData = createSelector(
  getComposerState,
  (composerState): ReadonlyArray<AvatarDataType> =>
    composerState?.step === ComposerStep.SetGroupMetadata
      ? composerState.userAvatarData
      : []
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
    if (selectedConversation === conversation.id) {
      conversation = {
        ...conversation,
        isSelected: true,
      };
    }

    // We always show pinned conversations
    if (conversation.isPinned) {
      pinnedConversations.push(conversation);
      continue;
    }

    if (conversation.activeAt) {
      if (conversation.isArchived) {
        archivedConversations.push(conversation);
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

export const getComposerConversationSearchTerm = createSelector(
  getComposerState,
  (composer): string => {
    if (!composer) {
      assert(false, 'getComposerConversationSearchTerm: composer is not open');
      return '';
    }
    if (composer.step === ComposerStep.SetGroupMetadata) {
      assert(
        false,
        'getComposerConversationSearchTerm: composer does not have a search term'
      );
      return '';
    }
    return composer.searchTerm;
  }
);

export const getIsFetchingUsername = createSelector(
  getComposerState,
  (composer): boolean => {
    if (!composer) {
      assert(false, 'getIsFetchingUsername: composer is not open');
      return false;
    }
    if (composer.step !== ComposerStep.StartDirectConversation) {
      assert(
        false,
        `getIsFetchingUsername: step ${composer.step} has no isFetchingUsername key`
      );
      return false;
    }
    return composer.isFetchingUsername;
  }
);

function isTrusted(conversation: ConversationType): boolean {
  if (conversation.type === 'group') {
    return true;
  }

  return Boolean(
    isInSystemContacts(conversation) ||
      conversation.profileSharing ||
      conversation.isMe
  );
}

function hasDisplayInfo(conversation: ConversationType): boolean {
  if (conversation.type === 'group') {
    return Boolean(conversation.name);
  }

  return Boolean(
    conversation.name ||
      conversation.profileName ||
      conversation.phoneNumber ||
      conversation.isMe
  );
}

function canComposeConversation(conversation: ConversationType): boolean {
  return Boolean(
    !conversation.isBlocked &&
      !isConversationUnregistered(conversation) &&
      hasDisplayInfo(conversation) &&
      isTrusted(conversation)
  );
}

export const getAllComposableConversations = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        !conversation.isBlocked &&
        !conversation.isGroupV1AndDisabled &&
        !isConversationUnregistered(conversation) &&
        // All conversation should have a title except in weird cases where
        // they don't, in that case we don't want to show these for Forwarding.
        conversation.title &&
        hasDisplayInfo(conversation)
    )
);

/**
 * getComposableContacts/getCandidateContactsForNewGroup both return contacts for the
 * composer and group members, a different list from your primary system contacts.
 * This list may include false positives, which is better than missing contacts.
 *
 * Note: the key difference between them:
 *   getComposableContacts includes Note to Self
 *   getCandidateContactsForNewGroup does not include Note to Self
 *
 * Because they filter unregistered contacts and that's (partially) determined by the
 * current time, it's possible for them to return stale contacts that have unregistered
 * if no other conversations change. This should be a rare false positive.
 */
export const getComposableContacts = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        conversation.type === 'direct' && canComposeConversation(conversation)
    )
);

export const getCandidateContactsForNewGroup = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        conversation.type === 'direct' &&
        !conversation.isMe &&
        canComposeConversation(conversation)
    )
);

export const getComposableGroups = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        conversation.type === 'group' && canComposeConversation(conversation)
    )
);

const getNormalizedComposerConversationSearchTerm = createSelector(
  getComposerConversationSearchTerm,
  (searchTerm: string): string => searchTerm.trim()
);

export const getFilteredComposeContacts = createSelector(
  getNormalizedComposerConversationSearchTerm,
  getComposableContacts,
  (
    searchTerm: string,
    contacts: Array<ConversationType>
  ): Array<ConversationType> => {
    return filterAndSortConversationsByTitle(contacts, searchTerm);
  }
);

export const getFilteredComposeGroups = createSelector(
  getNormalizedComposerConversationSearchTerm,
  getComposableGroups,
  (
    searchTerm: string,
    groups: Array<ConversationType>
  ): Array<ConversationType> => {
    return filterAndSortConversationsByTitle(groups, searchTerm);
  }
);

export const getFilteredCandidateContactsForNewGroup = createSelector(
  getCandidateContactsForNewGroup,
  getNormalizedComposerConversationSearchTerm,
  filterAndSortConversationsByTitle
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
    groupAvatar: undefined | Uint8Array;
    groupExpireTimer: number;
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
          groupExpireTimer: 0,
          selectedConversationIds: [],
        };
    }
  }
);

export const getComposeGroupAvatar = createSelector(
  getGroupCreationComposerState,
  (composerState): undefined | Uint8Array => composerState.groupAvatar
);

export const getComposeGroupName = createSelector(
  getGroupCreationComposerState,
  (composerState): string => composerState.groupName
);

export const getComposeGroupExpireTimer = createSelector(
  getGroupCreationComposerState,
  (composerState): number => composerState.groupExpireTimer
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
        log.warn(`getConversationSelector: Called with a falsey id ${id}`);
        // This will return a placeholder contact
        return selector(undefined);
      }

      const onUuid = getOwn(byUuid, id.toLowerCase ? id.toLowerCase() : id);
      if (onUuid) {
        return selector(onUuid);
      }
      const onE164 = getOwn(byE164, id);
      if (onE164) {
        return selector(onE164);
      }
      const onGroupId = getOwn(byGroupId, id);
      if (onGroupId) {
        return selector(onGroupId);
      }
      const onId = getOwn(byId, id);
      if (onId) {
        return selector(onId);
      }

      log.warn(`getConversationSelector: No conversation found for id ${id}`);
      // This will return a placeholder contact
      return selector(undefined);
    };
  }
);

export const getConversationByIdSelector = createSelector(
  getConversationLookup,
  conversationLookup =>
    (id: string): undefined | ConversationType =>
      getOwn(conversationLookup, id)
);

export const getConversationByUuidSelector = createSelector(
  getConversationsByUuid,
  conversationsByUuid =>
    (uuid: UUIDStringType): undefined | ConversationType =>
      getOwn(conversationsByUuid, uuid)
);

// A little optimization to reset our selector cache whenever high-level application data
//   changes: regionCode and userNumber.
export const getCachedSelectorForMessage = createSelector(
  getRegionCode,
  getUserNumber,
  (): typeof getPropsForBubble => {
    // Note: memoizee will check all parameters provided, and only run our selector
    //   if any of them have changed.
    return memoizee(getPropsForBubble, { max: 2000 });
  }
);

const getCachedConversationMemberColorsSelector = createSelector(
  getConversationSelector,
  getUserConversationId,
  (
    conversationSelector: GetConversationByIdType,
    ourConversationId: string
  ) => {
    return memoizee(
      (conversationId: string) => {
        const contactNameColors: Map<string, ContactNameColorType> = new Map();
        const {
          sortedGroupMembers = [],
          type,
          id: theirId,
        } = conversationSelector(conversationId);

        if (type === 'direct') {
          contactNameColors.set(ourConversationId, ContactNameColors[0]);
          contactNameColors.set(theirId, ContactNameColors[0]);
          return contactNameColors;
        }

        [...sortedGroupMembers]
          .sort((left, right) =>
            String(left.uuid) > String(right.uuid) ? 1 : -1
          )
          .forEach((member, i) => {
            contactNameColors.set(
              member.id,
              ContactNameColors[i % ContactNameColors.length]
            );
          });

        return contactNameColors;
      },
      { max: 100 }
    );
  }
);

export type ContactNameColorSelectorType = (
  conversationId: string,
  contactId: string
) => ContactNameColorType;

export const getContactNameColorSelector = createSelector(
  getCachedConversationMemberColorsSelector,
  conversationMemberColorsSelector => {
    return (
      conversationId: string,
      contactId: string
    ): ContactNameColorType => {
      const contactNameColors =
        conversationMemberColorsSelector(conversationId);
      const color = contactNameColors.get(contactId);
      if (!color) {
        log.warn(`No color generated for contact ${contactId}`);
        return ContactNameColors[0];
      }
      return color;
    };
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
  getUserUuid,
  getUserConversationId,
  getCallSelector,
  getActiveCall,
  getAccountSelector,
  getContactNameColorSelector,
  (
    messageSelector: typeof getPropsForBubble,
    messageLookup: MessageLookupType,
    selectedMessage: SelectedMessageType | undefined,
    conversationSelector: GetConversationByIdType,
    regionCode: string,
    ourNumber: string,
    ourUuid: UUIDStringType,
    ourConversationId: string,
    callSelector: CallSelectorType,
    activeCall: undefined | CallStateType,
    accountSelector: AccountSelectorType,
    contactNameColorSelector: ContactNameColorSelectorType
  ): GetMessageByIdType => {
    return (id: string) => {
      const message = messageLookup[id];
      if (!message) {
        return undefined;
      }

      return messageSelector(message, {
        conversationSelector,
        ourConversationId,
        ourNumber,
        ourUuid,
        regionCode,
        selectedMessageId: selectedMessage?.id,
        selectedMessageCounter: selectedMessage?.counter,
        contactNameColorSelector,
        callSelector,
        activeCall,
        accountSelector,
      });
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
    messageHeightChangeBaton: heightChangeMessageIds,
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
    return (id: string): TimelinePropsType => {
      const conversation = messagesByConversation[id];
      if (!conversation) {
        // TODO: DESKTOP-2340
        return {
          haveNewest: false,
          haveOldest: false,
          isLoadingMessages: false,
          resetCounter: 0,
          scrollToIndexCounter: 0,
          totalUnread: 0,
          items: [],
        };
      }

      return conversationMessagesSelector(conversation);
    };
  }
);

export const getInvitedContactsForNewlyCreatedGroup = createSelector(
  getConversationsByUuid,
  getConversations,
  (
    conversationLookup,
    { invitedUuidsForNewlyCreatedGroup = [] }
  ): Array<ConversationType> =>
    deconstructLookup(conversationLookup, invitedUuidsForNewlyCreatedGroup)
);

export const getConversationsWithCustomColorSelector = createSelector(
  getAllConversations,
  conversations => {
    return (colorId: string): Array<ConversationType> => {
      return conversations.filter(
        conversation => conversation.customColorId === colorId
      );
    };
  }
);

export function isMissingRequiredProfileSharing(
  conversation: ConversationType
): boolean {
  const doesConversationRequireIt =
    !conversation.left &&
    (isGroupV1(conversation) || isDirectConversation(conversation));

  return Boolean(
    doesConversationRequireIt &&
      !conversation.profileSharing &&
      window.Signal.RemoteConfig.isEnabled('desktop.mandatoryProfileSharing') &&
      conversation.messageCount &&
      conversation.messageCount > 0
  );
}

export const getGroupAdminsSelector = createSelector(
  getConversationSelector,
  (conversationSelector: GetConversationByIdType) => {
    return (conversationId: string): Array<ConversationType> => {
      const {
        groupId,
        groupVersion,
        memberships = [],
      } = conversationSelector(conversationId);

      if (
        !isGroupV2({
          groupId,
          groupVersion,
        })
      ) {
        return [];
      }

      const admins: Array<ConversationType> = [];
      memberships.forEach(membership => {
        if (membership.isAdmin) {
          const admin = conversationSelector(membership.uuid);
          admins.push(admin);
        }
      });
      return admins;
    };
  }
);

const getOutboundMessagesPendingConversationVerification = createSelector(
  getConversations,
  (
    conversations: Readonly<ConversationsStateType>
  ): Record<string, Array<string>> =>
    conversations.outboundMessagesPendingConversationVerification
);

const getConversationIdsStoppingMessageSendBecauseOfVerification =
  createSelector(
    getOutboundMessagesPendingConversationVerification,
    (outboundMessagesPendingConversationVerification): Array<string> =>
      Object.keys(outboundMessagesPendingConversationVerification)
  );

export const getConversationsStoppingMessageSendBecauseOfVerification =
  createSelector(
    getConversationByIdSelector,
    getConversationIdsStoppingMessageSendBecauseOfVerification,
    (
      conversationSelector: (id: string) => undefined | ConversationType,
      conversationIds: ReadonlyArray<string>
    ): Array<ConversationType> => {
      const conversations = conversationIds
        .map(conversationId => conversationSelector(conversationId))
        .filter(isNotNil);
      return sortByTitle(conversations);
    }
  );

export const getMessageIdsPendingBecauseOfVerification = createSelector(
  getOutboundMessagesPendingConversationVerification,
  (outboundMessagesPendingConversationVerification): Set<string> => {
    const result = new Set<string>();
    Object.values(outboundMessagesPendingConversationVerification).forEach(
      messageGroup => {
        messageGroup.forEach(messageId => {
          result.add(messageId);
        });
      }
    );
    return result;
  }
);

export const getNumberOfMessagesPendingBecauseOfVerification = createSelector(
  getMessageIdsPendingBecauseOfVerification,
  (messageIds: Readonly<Set<string>>): number => messageIds.size
);
