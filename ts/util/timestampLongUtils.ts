// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';

import { normalizeNumber } from './normalizeNumber';

export function getSafeLongFromTimestamp(timestamp = 0): Long {
  if (timestamp >= Number.MAX_SAFE_INTEGER) {
    return Long.MAX_VALUE;
  }

  return Long.fromNumber(timestamp);
}

export function getTimestampFromLong(value?: Long | number | null): number {
  if (!value) {
    return 0;
  }

  const num = normalizeNumber(value);

  if (num >= Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }

  return num;
}
