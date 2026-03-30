// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { MAX_SAFE_DATE } from './timestamp.std.ts';
import { toNumber } from './toNumber.std.ts';

export function getSafeLongFromTimestamp(
  timestamp = 0,
  maxValue: bigint | number = MAX_SAFE_DATE
): bigint {
  if (timestamp >= MAX_SAFE_DATE) {
    if (typeof maxValue === 'number') {
      return BigInt(maxValue);
    }
    return maxValue;
  }

  return BigInt(timestamp);
}

export function getTimestampFromLong(
  value?: bigint | null,
  maxValue = MAX_SAFE_DATE
): number {
  if (!value || value < 0n) {
    return 0;
  }

  const num = toNumber(value);

  if (num > MAX_SAFE_DATE) {
    return maxValue;
  }

  return num;
}

export class InvalidTimestampError extends Error {
  constructor(message: string) {
    super(`InvalidTimestampError: ${message}`);
  }
}

export function getCheckedTimestampFromLong(value?: bigint | null): number {
  if (value == null) {
    throw new InvalidTimestampError('No number');
  }

  const num = toNumber(value);

  if (num < 0) {
    throw new InvalidTimestampError('Underflow');
  }

  if (num > MAX_SAFE_DATE) {
    throw new InvalidTimestampError('Overflow');
  }

  return num;
}

export function getTimestampOrUndefinedFromLong(
  value?: bigint | null
): number | undefined {
  if (!value || value === 0n) {
    return undefined;
  }

  return getTimestampFromLong(value);
}

export function getCheckedTimestampOrUndefinedFromLong(
  value?: bigint | null
): number | undefined {
  if (!value || value === 0n) {
    return undefined;
  }

  return getCheckedTimestampFromLong(value);
}
