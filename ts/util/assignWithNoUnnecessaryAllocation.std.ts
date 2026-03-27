// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * This function is like `Object.assign` but won't create a new object if we don't need
 * to. This is purely a performance optimization.
 *
 * This is useful in places where we don't want to create a new object unnecessarily,
 * like in reducers where we might cause an unnecessary re-render.
 *
 * See the tests for the specifics of how this works.
 */
export function assignWithNoUnnecessaryAllocation<T extends object>(
  obj: Readonly<T>,
  source: Readonly<Partial<T>>
): T {
  // We want to bail early so we use `for .. in` instead of `Object.keys` or similar.
  // oxlint-disable-next-line signal-desktop/no-for-in
  for (const key in source) {
    if (!Object.hasOwn(source, key)) {
      continue;
    }
    if (!Object.hasOwn(obj, key) || obj[key] !== source[key]) {
      return { ...obj, ...source };
    }
  }
  return obj;
}
