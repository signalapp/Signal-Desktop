// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export type StoryDistributionIdString = string;

// Function stub for generateStoryDistributionId
export function generateStoryDistributionId(): StoryDistributionIdString {
  return '00000000-0000-0000-0000-000000000000';
}

// Function stub for normalizeStoryDistributionId
export function normalizeStoryDistributionId(id: string, _context?: string): StoryDistributionIdString {
  return id as StoryDistributionIdString;
}

// Function stub for isStoryDistributionId
export function isStoryDistributionId(value: unknown): value is StoryDistributionIdString {
  return typeof value === 'string';
}
