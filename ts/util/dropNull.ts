// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function dropNull<T>(
  value: NonNullable<T> | null | undefined
): T | undefined {
  if (value === null) {
    return undefined;
  }
  return value;
}
