// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';

import { MAX_SAFE_DATE } from './timestamp';

export function getSafeLongFromTimestamp(
  timestamp = 0,
  maxValue: Long | number = MAX_SAFE_DATE
): Long {
  if (timestamp >= MAX_SAFE_DATE) {
    if (typeof maxValue === 'number') {
      return Long.fromNumber(maxValue);
    }
    return maxValue;
  }

  return Long.fromNumber(timestamp);
}

export function getTimestampFromLong(
  value?: Long | null,
  maxValue = MAX_SAFE_DATE
): number {
  if (!value || value.isNegative()) {
    return 0;
  }

  const num = value.toNumber();

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

export function getCheckedTimestampFromLong(value?: Long | null): number {
  if (value == null) {
    throw new InvalidTimestampError('No number');
  }

  const num = value.toNumber();

  if (num < 0) {
    throw new InvalidTimestampError('Underflow');
  }

  if (num > MAX_SAFE_DATE) {
    throw new InvalidTimestampError('Overflow');
  }

  return num;
}

export function getTimestampOrUndefinedFromLong(
  value?: Long | null
): number | undefined {
  if (!value || value.isZero()) {
    return undefined;
  }

  return getTimestampFromLong(value);
}

export function getCheckedTimestampOrUndefinedFromLong(
  value?: Long | null
): number | undefined {
  if (!value || value.isZero()) {
    return undefined;
  }

  return getCheckedTimestampFromLong(value);
}
