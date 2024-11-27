// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import memoizee from 'memoizee';
import { isNumber, pick } from 'lodash';
import { createSelector } from 'reselect';

import type { StateType } from '../reducer';

import type {
  ConversationLookupType,
  ConversationMessageType,
  ConversationsStateType,
  ConversationType,
  ConversationVerificationData,
  MessageLookupType,
  MessagesByConversationType,
  MessageTimestamps,
  PreJoinConversationType,
} from '../ducks/conversations';
import type { StoriesStateType, StoryDataType } from '../ducks/stories';
import {
  ComposerStep,
  OneTimeModalState,
  ConversationVerificationState,
} from '../ducks/conversationsEnums';
import { getOwn } from '../../util/getOwn';
import type { UUIDFetchStateType } from '../../util/uuidFetchState';
import { deconstructLookup } from '../../util/deconstructLookup';
import type { PropsDataType as TimelinePropsType } from '../../components/conversation/Timeline';
import { assertDev } from '../../util/assert';
import { isConversationUnregistered } from '../../util/isConversationUnregistered';
import { filterAndSortConversations } from '../../util/filterAndSortConversations';
import type { ContactNameColorType } from '../../types/Colors';
import { ContactNameColors } from '../../types/Colors';
import type { AvatarDataType } from '../../types/Avatar';
import type { AciString, ServiceIdString } from '../../types/ServiceId';
import { normalizeServiceId } from '../../types/ServiceId';
import { isInSystemContacts } from '../../util/isInSystemContacts';
import { isSignalConnection } from '../../util/getSignalConnections';
import { sortByTitle } from '../../util/sortByTitle';
import { DurationInSeconds } from '../../util/durations';
import {
  isDirectConversation,
  isGroupV1,
  isGroupV2,
} from '../../util/whatTypeOfConversation';
import { isGroupInStoryMode } from '../../util/isGroupInStoryMode';

import {
  getIntl,
  getRegionCode,
  getUserConversationId,
  getUserNumber,
} from './user';
import { getPinnedConversationIds } from './items';
import * as log from '../../logging/log';
import { TimelineMessageLoadingState } from '../../util/timelineUtil';
import { isSignalConversation } from '../../util/isSignalConversation';
import { reduce } from '../../util/iterables';
import { getConversationTitleForPanelType } from '../../util/getConversationTitleForPanelType';
import type { PanelRenderType } from '../../types/Panels';
import type { HasStories } from '../../types/Stories';
import { getHasStoriesSelector } from './stories2';
import { canEditMessage } from '../../util/canEditMessage';
import { isOutgoing } from '../../messages/helpers';
import {
  countAllConversationsUnreadStats,
  type UnreadStats,
} from '../../util/countUnreadStats';

export type ConversationWithStoriesType = ConversationType & {
  hasStories?: HasStories;
};

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
    title: window.i18n('icu:unknownContact'),
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

export const getConversationsByServiceId = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByServiceId;
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
export const getHasPanelOpen = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return state.targetedConversationPanels.watermark > 0;
  }
);
export const getConversationsByUsername = createSelector(
  getConversations,
  (state: ConversationsStateType): ConversationLookupType => {
    return state.conversationsByUsername;
  }
);

export const getAllConversations = createSelector(
  getConversationLookup,
  (lookup): Array<ConversationType> => Object.values(lookup)
);

export const getAllSignalConnections = createSelector(
  getAllConversations,
  (conversations): Array<ConversationType> =>
    conversations.filter(isSignalConnection)
);

export const getSafeConversationWithSameTitle = createSelector(
  getAllConversations,
  (
    _state: StateType,
    {
      possiblyUnsafeConversation,
    }: {
      possiblyUnsafeConversation: ConversationType;
    }
  ) => possiblyUnsafeConversation,
  (conversations, possiblyUnsafeConversation): ConversationType | undefined => {
    const conversationsWithSameTitle = conversations.filter(conversation => {
      return conversation.title === possiblyUnsafeConversation.title;
    });
    assertDev(
      conversationsWithSameTitle.length,
      'Expected at least 1 conversation with the same title (this one)'
    );

    const safeConversation = conversationsWithSameTitle.find(
      otherConversation =>
        otherConversation.acceptedMessageRequest &&
        otherConversation.type === 'direct' &&
        otherConversation.id !== possiblyUnsafeConversation.id
    );

    return safeConversation;
  }
);

export const getSelectedConversationId = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.selectedConversationId;
  }
);

type TargetedMessageType = {
  id: string;
  counter: number;
};
export const getTargetedMessage = createSelector(
  getConversations,
  (state: ConversationsStateType): TargetedMessageType | undefined => {
    if (!state.targetedMessage) {
      return undefined;
    }

    return {
      id: state.targetedMessage,
      counter: state.targetedMessageCounter,
    };
  }
);
export const getTargetedMessageSource = createSelector(
  getConversations,
  (state: ConversationsStateType): string | undefined => {
    return state.targetedMessageSource;
  }
);
export const getSelectedMessageIds = createSelector(
  getConversations,
  (state: ConversationsStateType): ReadonlyArray<string> | undefined => {
    return state.selectedMessageIds;
  }
);
export const getLastSelectedMessage = createSelector(
  getConversations,
  (state: ConversationsStateType): MessageTimestamps | undefined => {
    return state.lastSelectedMessage;
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

export const getConversationMessages = createSelector(
  getSelectedConversationId,
  getMessagesByConversation,
  (
    conversationId,
    messagesByConversation
  ): ConversationMessageType | undefined => {
    return conversationId ? messagesByConversation[conversationId] : undefined;
  }
);

const collator = new Intl.Collator();

// Note: we will probably want to put i18n and regionCode back when we are formatting
//   phone numbers and contacts from scratch here again.
export const _getConversationComparator = () => {
  return (left: ConversationType, right: ConversationType): number => {
    // These two fields can be sorted with each other; they are timestamps
    const leftTimestamp = left.lastMessageReceivedAtMs || left.timestamp;
    const rightTimestamp = right.lastMessageReceivedAtMs || right.timestamp;
    if (leftTimestamp && !rightTimestamp) {
      return -1;
    }
    if (rightTimestamp && !leftTimestamp) {
      return 1;
    }
    if (leftTimestamp && rightTimestamp && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    // This field looks like a timestamp, but is actually a counter
    const leftCounter = left.lastMessageReceivedAt;
    const rightCounter = right.lastMessageReceivedAt;
    if (leftCounter && !rightCounter) {
      return -1;
    }
    if (rightCounter && !leftCounter) {
      return 1;
    }
    if (leftCounter && rightCounter && leftCounter !== rightCounter) {
      return rightCounter - leftCounter;
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

type LeftPaneLists = Readonly<{
  conversations: ReadonlyArray<ConversationType>;
  archivedConversations: ReadonlyArray<ConversationType>;
  pinnedConversations: ReadonlyArray<ConversationType>;
}>;

export const _getLeftPaneLists = (
  lookup: ConversationLookupType,
  comparator: (left: ConversationType, right: ConversationType) => number,
  selectedConversation?: string,
  pinnedConversationIds?: ReadonlyArray<string>
): LeftPaneLists => {
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
        assertDev(
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
        assertDev(
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
    ourConversationId: string | undefined
  ): ConversationType => {
    if (!ourConversationId) {
      return getPlaceholderContact();
    }

    return lookup[ourConversationId] || getPlaceholderContact();
  }
);

export const getComposerConversationSearchTerm = createSelector(
  getComposerState,
  (composer): string => {
    if (!composer) {
      assertDev(
        false,
        'getComposerConversationSearchTerm: composer is not open'
      );
      return '';
    }
    if (composer.step === ComposerStep.SetGroupMetadata) {
      assertDev(
        false,
        'getComposerConversationSearchTerm: composer does not have a search term'
      );
      return '';
    }
    return composer.searchTerm;
  }
);

export const getComposerSelectedRegion = createSelector(
  getComposerState,
  (composer): string => {
    if (!composer) {
      assertDev(false, 'getComposerSelectedRegion: composer is not open');
      return '';
    }
    if (composer.step !== ComposerStep.FindByPhoneNumber) {
      assertDev(
        false,
        'getComposerSelectedRegion: composer does not have a selected region'
      );
      return '';
    }
    return composer.selectedRegion;
  }
);

export const getComposerUUIDFetchState = createSelector(
  getComposerState,
  (composer): UUIDFetchStateType => {
    if (!composer) {
      assertDev(false, 'getIsFetchingUsername: composer is not open');
      return {};
    }
    if (
      composer.step !== ComposerStep.StartDirectConversation &&
      composer.step !== ComposerStep.FindByUsername &&
      composer.step !== ComposerStep.FindByPhoneNumber &&
      composer.step !== ComposerStep.ChooseGroupMembers
    ) {
      assertDev(
        false,
        `getComposerUUIDFetchState: step ${composer.step} ` +
          'has no uuidFetchState key'
      );
      return {};
    }
    return composer.uuidFetchState;
  }
);

export const getHasContactSpoofingReview = createSelector(
  getConversations,
  (state: ConversationsStateType): boolean => {
    return state.hasContactSpoofingReview;
  }
);

function isTrusted(conversation: ConversationType): boolean {
  if (conversation.type === 'group') {
    return true;
  }

  return Boolean(
    isInSystemContacts(conversation) ||
      conversation.sharedGroupNames.length > 0 ||
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
    !isSignalConversation(conversation) &&
      !conversation.isBlocked &&
      !conversation.removalStage &&
      ((isGroupV2(conversation) && !conversation.left) ||
        !isConversationUnregistered(conversation)) &&
      hasDisplayInfo(conversation) &&
      isTrusted(conversation)
  );
}

export const getAllComposableConversations = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(
      conversation =>
        !isSignalConversation(conversation) &&
        !conversation.isBlocked &&
        !conversation.removalStage &&
        !conversation.isGroupV1AndDisabled &&
        ((isGroupV2(conversation) && !conversation.left) ||
          !isConversationUnregistered(conversation)) &&
        // All conversation should have a title except in weird cases where
        // they don't, in that case we don't want to show these for Forwarding.
        conversation.titleNoDefault &&
        hasDisplayInfo(conversation)
    )
);

export const getAllGroupsWithInviteAccess = createSelector(
  getConversationLookup,
  (conversationLookup: ConversationLookupType): Array<ConversationType> =>
    Object.values(conversationLookup).filter(conversation => {
      return (
        conversation.type === 'group' &&
        conversation.title &&
        conversation.canAddNewMembers
      );
    })
);

export const getAllConversationsUnreadStats = createSelector(
  getAllConversations,
  (conversations): UnreadStats => {
    return countAllConversationsUnreadStats(conversations, {
      includeMuted: false,
    });
  }
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

const getConversationIdsWithStories = createSelector(
  (state: StateType): StoriesStateType => state.stories,
  (stories: StoriesStateType): Set<string> => {
    return new Set(stories.stories.map(({ conversationId }) => conversationId));
  }
);

export const getNonGroupStories = createSelector(
  getComposableGroups,
  getConversationIdsWithStories,
  (
    groups: Array<ConversationType>,
    conversationIdsWithStories: Set<string>
  ): Array<ConversationType> => {
    return groups.filter(
      group => !isGroupInStoryMode(group, conversationIdsWithStories)
    );
  }
);

export const selectMostRecentActiveStoryTimestampByGroupOrDistributionList =
  createSelector(
    (state: StateType): ReadonlyArray<StoryDataType> => state.stories.stories,
    (stories: ReadonlyArray<StoryDataType>): Record<string, number> => {
      return reduce<StoryDataType, Record<string, number>>(
        stories,
        (acc, story) => {
          const distributionListOrConversationId =
            story.storyDistributionListId ?? story.conversationId;
          const cur = acc[distributionListOrConversationId];
          if (cur && story.timestamp < cur) {
            return acc;
          }
          return {
            ...acc,
            [distributionListOrConversationId]: story.timestamp,
          };
        },
        {}
      );
    }
  );

export const getGroupStories = createSelector(
  getConversationLookup,
  getConversationIdsWithStories,
  getHasStoriesSelector,
  (
    conversationLookup: ConversationLookupType,
    conversationIdsWithStories: Set<string>,
    hasStoriesSelector
  ): Array<ConversationWithStoriesType> => {
    return Object.values(conversationLookup)
      .filter(
        conversation =>
          isGroupInStoryMode(conversation, conversationIdsWithStories) &&
          !conversation.left
      )
      .map(conversation => ({
        ...conversation,
        hasStories: hasStoriesSelector(conversation.id),
      }));
  }
);

const getNormalizedComposerConversationSearchTerm = createSelector(
  getComposerConversationSearchTerm,
  (searchTerm: string): string => searchTerm.trim()
);

export const getFilteredComposeContacts = createSelector(
  getNormalizedComposerConversationSearchTerm,
  getComposableContacts,
  getRegionCode,
  (
    searchTerm: string,
    contacts: ReadonlyArray<ConversationType>,
    regionCode: string | undefined
  ): Array<ConversationType> => {
    return filterAndSortConversations(contacts, searchTerm, regionCode);
  }
);

export const getFilteredComposeGroups = createSelector(
  getNormalizedComposerConversationSearchTerm,
  getComposableGroups,
  getRegionCode,
  (
    searchTerm: string,
    groups: ReadonlyArray<ConversationType>,
    regionCode: string | undefined
  ): Array<
    ConversationType & {
      membersCount: number;
      disabledReason: undefined;
      memberships: ReadonlyArray<{
        aci: AciString;
        isAdmin: boolean;
      }>;
    }
  > => {
    return filterAndSortConversations(groups, searchTerm, regionCode).map(
      group => ({
        ...group,
        // we don't disable groups when composing, already filtered
        disabledReason: undefined,
        // should always be populated for a group
        membersCount: group.membersCount ?? 0,
        memberships: group.memberships ?? [],
      })
    );
  }
);

export const getFilteredCandidateContactsForNewGroup = createSelector(
  getCandidateContactsForNewGroup,
  getNormalizedComposerConversationSearchTerm,
  getRegionCode,
  (contacts, searchTerm, regionCode): Array<ConversationType> => {
    return filterAndSortConversations(contacts, searchTerm, regionCode);
  }
);

const getGroupCreationComposerState = createSelector(
  getComposerState,
  (
    composerState
  ): {
    groupName: string;
    groupAvatar: undefined | Uint8Array;
    groupExpireTimer: DurationInSeconds;
    selectedConversationIds: ReadonlyArray<string>;
  } => {
    switch (composerState?.step) {
      case ComposerStep.ChooseGroupMembers:
      case ComposerStep.SetGroupMetadata:
        return composerState;
      default:
        assertDev(
          false,
          'getSetGroupMetadataComposerState: expected step to be SetGroupMetadata'
        );
        return {
          groupName: '',
          groupAvatar: undefined,
          groupExpireTimer: DurationInSeconds.ZERO,
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
  (composerState): DurationInSeconds => composerState.groupExpireTimer
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

export type GetConversationByAnyIdSelectorType = (
  id?: string
) => ConversationType | undefined;
export const getConversationByAnyIdSelector = createSelector(
  getConversationLookup,
  getConversationsByServiceId,
  getConversationsByE164,
  getConversationsByGroupId,
  (
    byId: ConversationLookupType,
    byServiceId: ConversationLookupType,
    byE164: ConversationLookupType,
    byGroupId: ConversationLookupType
  ): GetConversationByAnyIdSelectorType => {
    return (id?: string) => {
      if (!id) {
        return undefined;
      }

      const onGroupId = getOwn(byGroupId, id);
      if (onGroupId) {
        return onGroupId;
      }
      const onServiceId = getOwn(
        byServiceId,
        normalizeServiceId(id, 'getConversationSelector')
      );
      if (onServiceId) {
        return onServiceId;
      }
      const onE164 = getOwn(byE164, id);
      if (onE164) {
        return onE164;
      }
      const onId = getOwn(byId, id);
      if (onId) {
        return onId;
      }

      return undefined;
    };
  }
);

export type GetConversationByIdType = (id?: string) => ConversationType;
export const getConversationSelector = createSelector(
  getCachedSelectorForConversation,
  getConversationByAnyIdSelector,
  (
    selector: CachedConversationSelectorType,
    getById: GetConversationByAnyIdSelectorType
  ): GetConversationByIdType => {
    return (id?: string) => {
      if (!id) {
        return selector(undefined);
      }

      const byId = getById(id);
      if (byId) {
        return selector(byId);
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

export const getConversationByServiceIdSelector = createSelector(
  getConversationsByServiceId,
  conversationsByServiceId =>
    (serviceId: ServiceIdString): undefined | ConversationType =>
      getOwn(conversationsByServiceId, serviceId)
);

export const getCachedConversationMemberColorsSelector = createSelector(
  getConversationSelector,
  getUserConversationId,
  (
    conversationSelector: GetConversationByIdType,
    ourConversationId: string | undefined
  ) => {
    return memoizee(
      (conversationId: string | undefined) => {
        const contactNameColors: Map<string, ContactNameColorType> = new Map();
        const {
          sortedGroupMembers = [],
          type,
          id: theirId,
        } = conversationSelector(conversationId);

        if (type === 'direct') {
          if (ourConversationId) {
            contactNameColors.set(ourConversationId, ContactNameColors[0]);
          }
          contactNameColors.set(theirId, ContactNameColors[0]);
          return contactNameColors;
        }

        [...sortedGroupMembers]
          .sort((left, right) =>
            String(left.serviceId) > String(right.serviceId) ? 1 : -1
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
  contactId: string | undefined
) => ContactNameColorType;

export const getContactNameColorSelector = createSelector(
  getCachedConversationMemberColorsSelector,
  conversationMemberColorsSelector => {
    return (
      conversationId: string,
      contactId: string | undefined
    ): ContactNameColorType => {
      const contactNameColors =
        conversationMemberColorsSelector(conversationId);
      return getContactNameColor(contactNameColors, contactId);
    };
  }
);

export const getContactNameColor = (
  contactNameColors: Map<string, string>,
  contactId: string | undefined
): string => {
  if (!contactId) {
    log.warn('No color generated for missing contactId');
    return ContactNameColors[0];
  }

  const color = contactNameColors.get(contactId);
  if (!color) {
    log.warn(`No color generated for contact ${contactId}`);
    return ContactNameColors[0];
  }
  return color;
};

export function _conversationMessagesSelector(
  conversation: ConversationMessageType
): TimelinePropsType {
  const {
    isNearBottom = null,
    messageChangeCounter,
    messageIds,
    messageLoadingState = null,
    metrics,
    scrollToMessageCounter,
    scrollToMessageId,
  } = conversation;

  const firstId = messageIds[0];
  const lastId =
    messageIds.length === 0 ? undefined : messageIds[messageIds.length - 1];

  const { oldestUnseen } = metrics;

  const haveNewest = !metrics.newest || !lastId || lastId === metrics.newest.id;
  const haveOldest =
    !metrics.oldest || !firstId || firstId === metrics.oldest.id;

  const items = messageIds;

  const oldestUnseenIndex = oldestUnseen
    ? messageIds.findIndex(id => id === oldestUnseen.id)
    : null;
  const scrollToIndex = scrollToMessageId
    ? messageIds.findIndex(id => id === scrollToMessageId)
    : null;
  const { totalUnseen } = metrics;

  return {
    haveNewest,
    haveOldest,
    isNearBottom,
    items,
    messageChangeCounter,
    messageLoadingState,
    oldestUnseenIndex:
      isNumber(oldestUnseenIndex) && oldestUnseenIndex >= 0
        ? oldestUnseenIndex
        : null,
    scrollToIndex:
      isNumber(scrollToIndex) && scrollToIndex >= 0 ? scrollToIndex : null,
    scrollToIndexCounter: scrollToMessageCounter,
    totalUnseen,
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
          messageChangeCounter: 0,
          messageLoadingState: TimelineMessageLoadingState.DoingInitialLoad,
          scrollToIndexCounter: 0,
          totalUnseen: 0,
          items: [],
          isNearBottom: null,
          oldestUnseenIndex: null,
          scrollToIndex: null,
        };
      }

      return conversationMessagesSelector(conversation);
    };
  }
);

export const getInvitedContactsForNewlyCreatedGroup = createSelector(
  getConversationsByServiceId,
  getConversations,
  (
    conversationLookup,
    { invitedServiceIdsForNewlyCreatedGroup = [] }
  ): Array<ConversationType> =>
    deconstructLookup(conversationLookup, invitedServiceIdsForNewlyCreatedGroup)
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
    !conversation.isMe &&
    !conversation.left &&
    !conversation.removalStage &&
    (isGroupV1(conversation) || isDirectConversation(conversation));

  return Boolean(
    doesConversationRequireIt &&
      !conversation.profileSharing &&
      conversation.hasMessages
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
          const admin = conversationSelector(membership.aci);
          admins.push(admin);
        }
      });
      return admins;
    };
  }
);

export const getContactSelector = createSelector(
  getConversationSelector,
  conversationSelector => {
    return (contactId: string) =>
      pick(conversationSelector(contactId), 'id', 'title', 'serviceId');
  }
);

export const getConversationVerificationData = createSelector(
  getConversations,
  (
    conversations: Readonly<ConversationsStateType>
  ): Record<string, ConversationVerificationData> =>
    conversations.verificationDataByConversation
);

export const getConversationIdsStoppedForVerification = createSelector(
  getConversationVerificationData,
  (verificationDataByConversation): Array<string> =>
    Object.keys(verificationDataByConversation)
);

export const getConversationServiceIdsStoppingSend = createSelector(
  getConversationVerificationData,
  (pendingData): Array<ServiceIdString> => {
    const result = new Set<ServiceIdString>();
    Object.values(pendingData).forEach(item => {
      if (item.type === ConversationVerificationState.PendingVerification) {
        item.serviceIdsNeedingVerification.forEach(serviceId => {
          result.add(serviceId);
        });

        if (item.byDistributionId) {
          Object.values(item.byDistributionId).forEach(distribution => {
            distribution.serviceIdsNeedingVerification.forEach(serviceId => {
              result.add(serviceId);
            });
          });
        }
      }
    });
    return Array.from(result);
  }
);

export const getConversationsStoppingSend = createSelector(
  getConversationSelector,
  getConversationServiceIdsStoppingSend,
  (
    conversationSelector: GetConversationByIdType,
    serviceIds: ReadonlyArray<ServiceIdString>
  ): Array<ConversationType> => {
    const conversations = serviceIds.map(serviceId =>
      conversationSelector(serviceId)
    );
    return sortByTitle(conversations);
  }
);

export const getHideStoryConversationIds = createSelector(
  getConversationLookup,
  (conversationLookup): Array<string> =>
    Object.keys(conversationLookup).filter(
      conversationId => conversationLookup[conversationId].hideStory
    )
);

export const getActivePanel = createSelector(
  getConversations,
  (conversations): PanelRenderType | undefined =>
    conversations.targetedConversationPanels.stack[
      conversations.targetedConversationPanels.watermark
    ]
);

type PanelInformationType = {
  currPanel: PanelRenderType | undefined;
  direction: 'push' | 'pop';
  prevPanel: PanelRenderType | undefined;
};

export const getPanelInformation = createSelector(
  getConversations,
  getActivePanel,
  (conversations, currPanel): PanelInformationType | undefined => {
    const { direction, watermark } = conversations.targetedConversationPanels;

    if (!direction) {
      return;
    }

    const watermarkDirection =
      direction === 'push' ? watermark - 1 : watermark + 1;
    const prevPanel =
      conversations.targetedConversationPanels.stack[watermarkDirection];

    return {
      currPanel,
      direction,
      prevPanel,
    };
  }
);

export const getIsPanelAnimating = createSelector(
  getConversations,
  (conversations): boolean => {
    return conversations.targetedConversationPanels.isAnimating;
  }
);

export const getWasPanelAnimated = createSelector(
  getConversations,
  (conversations): boolean => {
    return conversations.targetedConversationPanels.wasAnimated;
  }
);

export const getConversationTitle = createSelector(
  getIntl,
  getActivePanel,
  (i18n, panel): string | undefined =>
    getConversationTitleForPanelType(i18n, panel?.type)
);

// Note that this doesn't take into account max edit count. See canEditMessage.
export const getLastEditableMessageId = createSelector(
  getConversationMessages,
  getMessages,
  (conversationMessages, messagesLookup): string | undefined => {
    if (!conversationMessages) {
      return;
    }

    for (let i = conversationMessages.messageIds.length - 1; i >= 0; i -= 1) {
      const messageId = conversationMessages.messageIds[i];
      const message = messagesLookup[messageId];

      if (!message) {
        continue;
      }

      if (isOutgoing(message)) {
        return canEditMessage(message) ? message.id : undefined;
      }
    }

    return undefined;
  }
);

export const getPreloadedConversationId = createSelector(
  getConversations,
  ({ preloadData }): string | undefined => preloadData?.conversationId
);
