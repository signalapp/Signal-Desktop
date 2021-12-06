// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const add = <T>(set: Readonly<Set<T>>, item: T): Set<T> =>
  new Set(set).add(item);

export const remove = <T>(
  set: Readonly<Set<T>>,
  ...items: ReadonlyArray<T>
): Set<T> => {
  const clone = new Set(set);
  for (const item of items) {
    clone.delete(item);
  }
  return clone;
};

export const toggle = <T>(
  set: Readonly<Set<T>>,
  item: Readonly<T>,
  shouldInclude: boolean
): Set<T> => (shouldInclude ? add : remove)(set, item);
