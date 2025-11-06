// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

import type { ServiceIdString } from '../../types/ServiceId.std.js';

export type StoryDataType = never;
export type StoriesStateType = Record<string, never>;
export type ViewStoryActionCreatorType = (...args: Array<any>) => any;
export type ViewUserStoriesActionCreatorType = (...args: Array<any>) => any;

// RecipientEntry matches the test structure for untrustedByConversation
export type RecipientEntry = {
  serviceIds: Array<ServiceIdString>;
  byDistributionId?: Record<string, { serviceIds: Array<ServiceIdString> }>;
};

// RecipientsByConversation maps conversation IDs to RecipientEntry
export type RecipientsByConversation = Record<string, RecipientEntry>;

// Action creators
export const viewStory: ViewStoryActionCreatorType = () => ({ type: 'stories/STUB' as const });
export const viewUserStories: ViewUserStoriesActionCreatorType = () => ({ type: 'stories/STUB' as const });
export const storyChanged = (..._args: Array<any>) => ({ type: 'stories/STUB' as const });
export const removeAllContactStories = () => ({ type: 'stories/STUB' as const });

export const actions = {
  setHasAllStoriesUnmuted: () => ({ type: 'stories/STUB' as const }),
  removeAllStories: () => ({ type: 'stories/STUB' as const }),
  viewStory,
  viewUserStories,
  storyChanged,
  removeAllContactStories,
};

export const reducer = () => ({});
export const getEmptyState = (): StoriesStateType => ({});
export const useStoriesActions = () => actions;

export type StoriesActionType = never;
