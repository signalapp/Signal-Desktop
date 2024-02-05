// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const getStoriesDisabled = (): boolean =>
  window.Events.getHasStoriesDisabled();

export const getStoriesBlocked = (): boolean => getStoriesDisabled();
