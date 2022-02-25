// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function clearTimeoutIfNecessary(
  timeout: undefined | null | ReturnType<typeof setTimeout>
): void {
  if (timeout) {
    clearTimeout(timeout);
  }
}
