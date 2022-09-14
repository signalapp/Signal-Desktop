// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isNotNil<T>(value: T | null | undefined): value is T {
  if (value == null) {
    return false;
  }
  return true;
}
