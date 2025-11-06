// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

import type { ServiceIdString } from '../../types/ServiceId.std.js';

export type StoryDistributionListDataType = {
  id: string;
  name: string;
  memberServiceIds: Array<ServiceIdString>;
  allowsReplies: boolean;
  isBlockList: boolean;
};

export type StoryDistributionListStateType = {
  distributionLists: Array<StoryDistributionListDataType>;
};

export type StoryDistributionIdString = string;

// Action type constants
export const MODIFY_LIST = 'storyDistributionLists/MODIFY_LIST';
export const DELETE_LIST = 'storyDistributionLists/DELETE_LIST';
export const HIDE_MY_STORIES_FROM = 'storyDistributionLists/HIDE_MY_STORIES_FROM';
export const VIEWERS_CHANGED = 'storyDistributionLists/VIEWERS_CHANGED';

// Action creators
export const createDistributionList = (..._args: Array<any>) => ({ type: 'storyDistributionLists/STUB' as const });
export const modifyDistributionList = (..._args: Array<any>) => ({ type: MODIFY_LIST });
export const removeMemberFromAllDistributionLists = (..._args: Array<any>) => ({ type: 'storyDistributionLists/STUB' as const });
export const removeMembersFromDistributionList = (..._args: Array<any>) => ({ type: 'storyDistributionLists/STUB' as const });

export const actions = {
  createDistributionList,
  modifyDistributionList,
  removeMemberFromAllDistributionLists,
  removeMembersFromDistributionList,
};

export const reducer = (): StoryDistributionListStateType => ({
  distributionLists: [],
});

export const getEmptyState = (): StoryDistributionListStateType => ({
  distributionLists: [],
});

// Hook for actions
export const useStoryDistributionListsActions = () => actions;

export type StoryDistributionListsActionType = never;
