// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { reduce } from './iterables';

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
