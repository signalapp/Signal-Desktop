// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function makeLookup<T>(
  items: ReadonlyArray<T>,
  key: keyof T
): Record<string, T> {
  const result: Record<string, T> = {};
  for (const item of items) {
    if (item != null && item[key] !== undefined) {
      result[String(item[key])] = item;
    }
  }
  return result;
}
