// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `SeenStatus` represents either the idea that a message doesn't need to track its seen
 * status, or the standard unseen/seen status pair.
 *
 * Unseen is a lot like unread - except that unseen messages only affect the placement
 * of the last seen indicator and the count it shows. Unread messages will affect the
 * left pane badging for conversations, as well as the overall badge count on the app.
 */
export enum SeenStatus {
  NotApplicable = 0,
  Unseen = 1,
  Seen = 2,
}

const STATUS_NUMBERS: Record<SeenStatus, number> = {
  [SeenStatus.NotApplicable]: 0,
  [SeenStatus.Unseen]: 1,
  [SeenStatus.Seen]: 2,
};

export const maxSeenStatus = (a: SeenStatus, b: SeenStatus): SeenStatus =>
  STATUS_NUMBERS[a] > STATUS_NUMBERS[b] ? a : b;
