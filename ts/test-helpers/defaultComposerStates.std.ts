// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ComposerStep } from '../state/ducks/conversationsEnums.std.js';
import { OneTimeModalState } from '../groups/toggleSelectedContactForGroupAddition.std.js';
import { DurationInSeconds } from '../util/durations/index.std.js';

export const defaultStartDirectConversationComposerState = {
  step: ComposerStep.StartDirectConversation as const,
  searchTerm: '',
  uuidFetchState: {},
};

export const defaultChooseGroupMembersComposerState = {
  step: ComposerStep.ChooseGroupMembers as const,
  searchTerm: '',
  uuidFetchState: {},
  groupAvatar: undefined,
  groupName: '',
  groupExpireTimer: DurationInSeconds.ZERO,
  maximumGroupSizeModalState: OneTimeModalState.NeverShown,
  recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
  selectedConversationIds: [],
  userAvatarData: [],
};

export const defaultSetGroupMetadataComposerState = {
  step: ComposerStep.SetGroupMetadata as const,
  isEditingAvatar: false,
  groupAvatar: undefined,
  groupName: '',
  groupExpireTimer: DurationInSeconds.ZERO,
  maximumGroupSizeModalState: OneTimeModalState.NeverShown,
  recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
  selectedConversationIds: [],
  userAvatarData: [],
  isCreating: false as const,
  hasError: false as const,
};
