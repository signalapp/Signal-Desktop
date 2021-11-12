// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ComposerStep } from '../../state/ducks/conversationsEnums';
import { OneTimeModalState } from '../../groups/toggleSelectedContactForGroupAddition';

export const defaultStartDirectConversationComposerState = {
  step: ComposerStep.StartDirectConversation as const,
  searchTerm: '',
  isFetchingUsername: false,
};

export const defaultChooseGroupMembersComposerState = {
  step: ComposerStep.ChooseGroupMembers as const,
  searchTerm: '',
  cantAddContactIdForModal: undefined,
  groupAvatar: undefined,
  groupName: '',
  groupExpireTimer: 0,
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
  groupExpireTimer: 0,
  maximumGroupSizeModalState: OneTimeModalState.NeverShown,
  recommendedGroupSizeModalState: OneTimeModalState.NeverShown,
  selectedConversationIds: [],
  userAvatarData: [],
  isCreating: false as const,
  hasError: false as const,
};
