// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isSorted(list: Iterable<number>): boolean {
  let previousItem: undefined | number;
  for (const item of list) {
    if (previousItem !== undefined && item < previousItem) {
      return false;
    }
    previousItem = item;
  }
  return true;
}
