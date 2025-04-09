// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import * as logging from '../logging/log';

const MAX_SAFE_TIMEOUT_DELAY = 2147483647; // max 32-bit signed integer

// Prefer using this function over setTimeout in any circumstances where
// the delay is not hardcoded to < MAX_SAFE_TIMEOUT_DELAY. Sets and returns a
// timeout if the delay is safe, otherwise does not set a timeout.
export function safeSetTimeout(
  callback: VoidFunction,
  delayMs: number
): NodeJS.Timeout | null {
  if (delayMs > MAX_SAFE_TIMEOUT_DELAY) {
    logging.warn(
      'safeSetTimeout: timeout is larger than maximum setTimeout delay'
    );
    return null;
  }

  return setTimeout(callback, delayMs);
}
