// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isNormalNumber } from './isNormalNumber';

const ONE_SECOND = 1000;
const MINIMAL_RETRY_AFTER = ONE_SECOND;

export function parseRetryAfter(value: unknown): number {
  if (typeof value !== 'string') {
    return MINIMAL_RETRY_AFTER;
  }

  let retryAfter = parseInt(value, 10);
  if (!isNormalNumber(retryAfter) || retryAfter.toString() !== value) {
    retryAfter = 0;
  }

  return Math.max(retryAfter * ONE_SECOND, MINIMAL_RETRY_AFTER);
}
