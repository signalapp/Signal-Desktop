// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export function getStoriesBlocked(): boolean {
  return true; // Stories are always blocked since feature is removed
}

export function getStoriesEnabled(): boolean {
  return false;
}

export function hasStoryViewReceiptSetting(): boolean {
  return false;
}

export function isStoryViewReceiptSettingEnabled(): boolean {
  return false;
}
