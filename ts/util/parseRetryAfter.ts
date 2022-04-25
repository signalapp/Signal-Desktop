// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SECOND, MINUTE } from './durations';
import { isNormalNumber } from './isNormalNumber';

const DEFAULT_RETRY_AFTER = MINUTE;
const MINIMAL_RETRY_AFTER = SECOND;

export function parseRetryAfterWithDefault(value: unknown): number {
  const retryAfter = parseRetryAfter(value);
  if (retryAfter === undefined) {
    return DEFAULT_RETRY_AFTER;
  }

  return Math.max(retryAfter, MINIMAL_RETRY_AFTER);
}

export function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const retryAfter = parseInt(value, 10);
  if (!isNormalNumber(retryAfter) || retryAfter.toString() !== value) {
    return undefined;
  }

  return retryAfter * SECOND;
}
