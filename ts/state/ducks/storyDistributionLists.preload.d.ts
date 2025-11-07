// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This is a type declaration stub for the compiled JS stub

export type StoryDistributionListDataType = {
  id: string;
  name: string;
  allowsReplies: boolean;
  isBlockList: boolean;
  memberServiceIds: Array<string>;
};

export type StoryDistributionListStateType = {
  distributionLists: Array<StoryDistributionListDataType>;
};

export const MODIFY_LIST = "storyDistributionLists/MODIFY_LIST";
export const DELETE_LIST = "storyDistributionLists/DELETE_LIST";
export const HIDE_MY_STORIES_FROM = "storyDistributionLists/HIDE_MY_STORIES_FROM";
export const VIEWERS_CHANGED = "storyDistributionLists/VIEWERS_CHANGED";

export const createDistributionList: (...args: Array<any>) => { type: string };
export const modifyDistributionList: (...args: Array<any>) => { type: string };
export const removeMemberFromAllDistributionLists: (...args: Array<any>) => { type: string };
export const removeMembersFromDistributionList: (...args: Array<any>) => { type: string };

export const actions: {
  createDistributionList: typeof createDistributionList;
  modifyDistributionList: typeof modifyDistributionList;
  removeMemberFromAllDistributionLists: typeof removeMemberFromAllDistributionLists;
  removeMembersFromDistributionList: typeof removeMembersFromDistributionList;
};

export function reducer(): StoryDistributionListStateType;
export function getEmptyState(): StoryDistributionListStateType;
export function useStoryDistributionListsActions(): typeof actions;
