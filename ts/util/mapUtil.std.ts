// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { reduce } from './iterables.std.js';

/**
 * Like Lodash's `groupBy`, but returns a `Map`.
 */
export const groupBy = <T, ResultT>(
  iterable: Iterable<T>,
  fn: (value: T) => ResultT
): Map<ResultT, Array<T>> =>
  reduce(
    iterable,
    (result: Map<ResultT, Array<T>>, value: T) => {
      const key = fn(value);
      const existingGroup = result.get(key);
      if (existingGroup) {
        existingGroup.push(value);
      } else {
        result.set(key, [value]);
      }
      return result;
    },
    new Map<ResultT, Array<T>>()
  );

export const isEqual = <K, V>(
  left: ReadonlyMap<K, V>,
  right: ReadonlyMap<K, V>
): boolean => {
  if (left.size !== right.size) {
    return false;
  }

  for (const [key, value] of left) {
    if (!right.has(key)) {
      return false;
    }

    if (right.get(key) !== value) {
      return false;
    }
  }

  return true;
};
