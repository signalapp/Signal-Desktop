// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

const { without } = lodash;

export enum OneTimeModalState {
  NeverShown,
  Showing,
  Shown,
}

export function toggleSelectedContactForGroupAddition(
  conversationId: string,
  currentState: Readonly<{
    maxGroupSize: number;
    maxRecommendedGroupSize: number;
    maximumGroupSizeModalState: OneTimeModalState;
    numberOfContactsAlreadyInGroup: number;
    recommendedGroupSizeModalState: OneTimeModalState;
    selectedConversationIds: ReadonlyArray<string>;
  }>
): {
  maximumGroupSizeModalState: OneTimeModalState;
  recommendedGroupSizeModalState: OneTimeModalState;
  selectedConversationIds: ReadonlyArray<string>;
} {
  const {
    maxGroupSize,
    maxRecommendedGroupSize,
    numberOfContactsAlreadyInGroup,
    selectedConversationIds: oldSelectedConversationIds,
  } = currentState;
  let { maximumGroupSizeModalState, recommendedGroupSizeModalState } =
    currentState;

  const selectedConversationIds = without(
    oldSelectedConversationIds,
    conversationId
  );
  const shouldAdd =
    selectedConversationIds.length === oldSelectedConversationIds.length;
  if (shouldAdd) {
    const newExpectedMemberCount =
      selectedConversationIds.length + numberOfContactsAlreadyInGroup + 1;
    if (newExpectedMemberCount <= maxGroupSize) {
      if (
        newExpectedMemberCount === maxGroupSize &&
        maximumGroupSizeModalState === OneTimeModalState.NeverShown
      ) {
        maximumGroupSizeModalState = OneTimeModalState.Showing;
      } else if (
        newExpectedMemberCount >= maxRecommendedGroupSize &&
        recommendedGroupSizeModalState === OneTimeModalState.NeverShown
      ) {
        recommendedGroupSizeModalState = OneTimeModalState.Showing;
      }
      selectedConversationIds.push(conversationId);
    }
  }

  return {
    selectedConversationIds,
    maximumGroupSizeModalState,
    recommendedGroupSizeModalState,
  };
}
