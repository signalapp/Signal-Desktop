// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export type StoryDataType = never;
export type StoriesStateType = Record<string, never>;
export type ViewStoryActionCreatorType = (...args: Array<any>) => any;
export type ViewUserStoriesActionCreatorType = (...args: Array<any>) => any;

export const actions = {
  setHasAllStoriesUnmuted: () => ({ type: 'stories/STUB' as const }),
  removeAllStories: () => ({ type: 'stories/STUB' as const }),
};

export const reducer = () => ({});
export const getEmptyState = (): StoriesStateType => ({});
export const useStoriesActions = () => ({});

export type StoriesActionType = never;
