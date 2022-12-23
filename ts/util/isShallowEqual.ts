// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isShallowEqual<Obj extends Record<string, unknown>>(
  a: Obj,
  b: Obj
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }

  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
}
