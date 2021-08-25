// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `ReadStatus` represents your local read/viewed status of a single incoming message.
 * Messages go from Unread to Read to Viewed; they never go "backwards".
 *
 * Note that a conversation can be marked unread, which is not at the message level.
 *
 * Be careful when changing these values, as they are persisted. Notably, we previously
 * had a field called "unread", which is why Unread corresponds to 1 and Read to 0.
 */
export enum ReadStatus {
  Unread = 1,
  Read = 0,
  Viewed = 2,
}

const STATUS_NUMBERS: Record<ReadStatus, number> = {
  [ReadStatus.Unread]: 0,
  [ReadStatus.Read]: 1,
  [ReadStatus.Viewed]: 2,
};

export const maxReadStatus = (a: ReadStatus, b: ReadStatus): ReadStatus =>
  STATUS_NUMBERS[a] > STATUS_NUMBERS[b] ? a : b;
