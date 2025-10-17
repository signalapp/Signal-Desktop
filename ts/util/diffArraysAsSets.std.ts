// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function diffArraysAsSets<T>(
  starting: Array<T>,
  current: Array<T>
): { added: Array<T>; removed: Array<T> } {
  const startingSet = new Set(starting);
  const currentSet = new Set(current);

  const removed = [];
  for (const item of startingSet) {
    if (!currentSet.has(item)) {
      removed.push(item);
    }
  }

  const added = [];
  for (const item of currentSet) {
    if (!startingSet.has(item)) {
      added.push(item);
    }
  }

  return { added, removed };
}
