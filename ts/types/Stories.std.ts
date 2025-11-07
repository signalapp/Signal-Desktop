// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export type StoryDistributionIdString = string;
export type AttachmentType = any;
export type StoryDistribution = never;
export type StoryDistributionListDataType = never;
export type StoryDistributionListWithMembersDataType = never;

// Enum stub for HasStories (used as both type and value)
export const HasStories = {
  Self: 'self' as const,
  Unread: 'unread' as const,
  Read: 'read' as const,
};
export type HasStories = typeof HasStories[keyof typeof HasStories] | undefined;

// Enum stub for StoryViewModeType (used as both type and value)
export const StoryViewModeType = {
  User: 'user' as const,
  Single: 'single' as const,
  Unread: 'unread' as const,
};
export type StoryViewModeType = typeof StoryViewModeType[keyof typeof StoryViewModeType];

// Enum stub for StoryViewTargetType
export type StoryViewTargetType = never;

// Enum stub for StorySendMode
export enum StorySendMode {
  IfActive = 'IfActive',
  Always = 'Always',
  Never = 'Never',
}

// Constant stub for MY_STORY_ID
export const MY_STORY_ID = '00000000-0000-0000-0000-000000000000';
