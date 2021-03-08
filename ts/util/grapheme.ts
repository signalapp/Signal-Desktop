// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function count(str: string): number {
  const segments = new Intl.Segmenter().segment(str);
  const iterator = segments[Symbol.iterator]();

  let result = -1;
  for (let done = false; !done; result += 1) {
    done = Boolean(iterator.next().done);
  }
  return result;
}
