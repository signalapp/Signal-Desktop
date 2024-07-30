// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Calls clearTimeout on a timeout if it is defined.
 * Note: Do not use with intervals (e.g. setInterval). Results may be unexpected.
 * */
export function clearTimeoutIfNecessary(
  timeout: undefined | null | ReturnType<typeof setTimeout>
): void {
  if (timeout) {
    clearTimeout(timeout);
  }
}
