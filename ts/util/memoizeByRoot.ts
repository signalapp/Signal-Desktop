// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { defaultMemoize } from 'reselect';

import { strictAssert } from './assert';

// The difference between the function below and `defaultMemoize` from
// `reselect` is that it supports multiple "root" states. `reselect` is designed
// to interact with a single redux store and by default it memoizes only the
// last result of the selector (matched by its arguments). This works well when
// applied to singular entities living in the redux's state, but we need to
// apply selector to multitide of conversations and messages.
//
// The way it works is that it adds an extra memoization step that uses the
// first argument ("root") as a key in a weak map, and then applies the default
// `reselect`'s memoization function to the rest of the arguments. This way
// we essentially get a weak map of selectors by the "root".

// eslint-disable-next-line @typescript-eslint/ban-types
export function memoizeByRoot<F extends Function>(
  fn: F,
  equalityCheck?: <T>(a: T, b: T) => boolean
): F {
  // eslint-disable-next-line @typescript-eslint/ban-types
  const cache = new WeakMap<object, Function>();

  const wrap = (root: unknown, ...rest: Array<unknown>): unknown => {
    strictAssert(
      typeof root === 'object' && root !== null,
      'Root is not object'
    );

    let partial = cache.get(root);
    if (!partial) {
      partial = defaultMemoize((...args: Array<unknown>): unknown => {
        return fn(root, ...args);
      }, equalityCheck);

      cache.set(root, partial);
    }

    return partial(...rest);
  };

  return wrap as unknown as F;
}
