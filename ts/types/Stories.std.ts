// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

import type { ConversationType } from './Conversation.preload.js';
import type { ServiceIdString } from './ServiceId.js';

export type StoryViewType = never;
export type ConversationStoryType = never;
export type MyStoryType = never;
export type StorySendStateType = never;
export type StoryDataType = never;

// Re-export from ducks for test helpers
export type StoryDistributionListWithMembersDataType = {
  id: string;
  name: string;
  memberServiceIds: Array<ServiceIdString>;
  allowsReplies: boolean;
  isBlockList: boolean;
  members: Array<ConversationType>;
};

export type RecipientEntry = never;

// Export as both enum and type to support boolean values from stub
export enum HasStoriesEnum {
  Unread = 'Unread',
  Read = 'Read',
  IfMuted = 'IfMuted',
}

// HasStories type accepts both boolean (from stub) and enum values
export type HasStories = boolean | HasStoriesEnum;

// Re-export enum values for backward compatibility
export const HasStories = HasStoriesEnum;

export enum StorySendMode {
  Always = 'Always',
  Never = 'Never',
  IfActive = 'IfActive',
}

export enum StoryViewModeType {
  Single = 'Single',
  User = 'User',
  All = 'All',
  Hidden = 'Hidden',
  Unread = 'Unread',
}

export enum StoryViewTargetType {
  Replies = 'Replies',
  Views = 'Views',
  Single = 'Single',
}

export const MY_STORY_ID = 'MY_STORY_ID';

// Empty exports to satisfy TypeScript
export {};
