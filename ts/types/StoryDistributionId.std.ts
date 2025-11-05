// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export type StoryDistributionIdString = string & { __storyDistributionId: never };

// Stub functions
export function isStoryDistributionId(value: unknown): value is StoryDistributionIdString {
  return typeof value === 'string';
}

export function generateStoryDistributionId(): StoryDistributionIdString {
  return '' as StoryDistributionIdString;
}

export function normalizeStoryDistributionId(value: string): StoryDistributionIdString {
  return value as StoryDistributionIdString;
}
