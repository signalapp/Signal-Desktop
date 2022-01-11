// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { SECOND } from './durations';
import { isNormalNumber } from './isNormalNumber';

const MINIMAL_RETRY_AFTER = SECOND;

export function parseRetryAfter(value: unknown): number {
  if (typeof value !== 'string') {
    return MINIMAL_RETRY_AFTER;
  }

  let retryAfter = parseInt(value, 10);
  if (!isNormalNumber(retryAfter) || retryAfter.toString() !== value) {
    retryAfter = 0;
  }

  return Math.max(retryAfter * SECOND, MINIMAL_RETRY_AFTER);
}
