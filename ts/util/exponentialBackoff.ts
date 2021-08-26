// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as durations from './durations';

const BACKOFF_FACTOR = 1.9;
const MAX_BACKOFF = 15 * durations.MINUTE;

/**
 * For a given attempt, how long should we sleep (in milliseconds)?
 *
 * The attempt should be a positive integer, and it is 1-indexed. The first attempt is 1,
 * the second is 2, and so on.
 *
 * This is modified from [iOS's codebase][0].
 *
 * [0]: https://github.com/signalapp/Signal-iOS/blob/6069741602421744edfb59923d2fb3a66b1b23c1/SignalServiceKit/src/Util/OWSOperation.swift
 */
export function exponentialBackoffSleepTime(attempt: number): number {
  const failureCount = attempt - 1;
  if (failureCount === 0) {
    return 0;
  }
  return Math.min(MAX_BACKOFF, 100 * BACKOFF_FACTOR ** failureCount);
}

/**
 * If I want to retry for X milliseconds, how many attempts is that, roughly? For example,
 * 24 hours (86,400,000 milliseconds) is 111 attempts.
 *
 * `desiredDurationMs` should be at least 1.
 */
export function exponentialBackoffMaxAttempts(
  desiredDurationMs: number
): number {
  let attempts = 0;
  let total = 0;
  // There's probably some algebra we could do here instead of this loop, but this is
  //   fast even for giant numbers, and is typically called just once at startup.
  do {
    attempts += 1;
    total += exponentialBackoffSleepTime(attempts);
  } while (total < desiredDurationMs);
  return attempts;
}
