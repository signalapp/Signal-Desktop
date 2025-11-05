// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export async function loadStories(): Promise<void> {
  // No-op
}

export function getStoriesForRedux(): Array<never> {
  return [];
}

export function getStoryDataFromMessageAttributes(..._args: Array<any>): undefined {
  return undefined;
}
