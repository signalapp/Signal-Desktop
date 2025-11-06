// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

// Re-export from ducks to avoid duplicate type definitions
export type { RecipientsByConversation } from '../ducks/stories.preload.js';

export const getStories = () => [];
export const getHasStories = () => false;
export const getStoryView = () => undefined;
export const hasSelectedStoryData = () => false;
export const getHasAnyFailedStorySends = () => false;
export const getStoriesNotificationCount = () => 0;
