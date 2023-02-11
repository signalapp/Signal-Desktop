// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isShallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a !== typeof b) {
    return false;
  }

  if (a == null || b == null) {
    return false;
  }
  if (typeof a !== 'object') {
    return false;
  }

  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }

  for (const key of keys) {
    if (
      (a as Record<string | number, unknown>)[key] !==
      (b as Record<string | number, unknown>)[key]
    ) {
      return false;
    }
  }

  return true;
}
