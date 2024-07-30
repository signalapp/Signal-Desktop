// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d';
import type { LoggerType } from '../types/Logging';
import { assertDev } from './assert';

export type GetMessageSentTimestampOptionsType = Readonly<{
  includeEdits?: boolean;
  log: LoggerType;
}>;

export function getMessageSentTimestamp(
  {
    editMessageTimestamp,
    sent_at: sentAt,
    timestamp,
  }: Pick<
    ReadonlyMessageAttributesType,
    'editMessageTimestamp' | 'sent_at' | 'timestamp'
  >,
  { includeEdits = true, log }: GetMessageSentTimestampOptionsType
): number {
  if (includeEdits && editMessageTimestamp) {
    return editMessageTimestamp;
  }

  if (sentAt) {
    return sentAt;
  }

  if (timestamp) {
    log.error('message lacked sent_at. Falling back to timestamp');
    return timestamp;
  }

  assertDev(
    false,
    'message lacked sent_at and timestamp. Falling back to current time'
  );
  return Date.now();
}
