// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function replaceIndex<T>(
  arr: ReadonlyArray<T>,
  index: number,
  newItem: T
): Array<T> {
  if (!(index in arr)) {
    throw new RangeError(`replaceIndex: ${index} out of range`);
  }

  const result = [...arr];
  result[index] = newItem;
  return result;
}
