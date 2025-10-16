// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';

import { removeDiacritics } from './removeDiacritics.std.js';

const cachedIndices: Map<
  Fuse.IFuseOptions<unknown>,
  WeakMap<ReadonlyArray<unknown>, Fuse<unknown>>
> = new Map();

export function getCachedFuseIndex<T>(
  list: ReadonlyArray<T>,
  options: Fuse.IFuseOptions<T>
): Fuse<T> {
  // Helper to retrieve a cached fuse index or create one if needed. Indices are uniquely
  // identified by their `options` and the `list` of values being indexed. Both should
  // remain referentially static in order to avoid unnecessarily re-indexing
  let indicesForOptions = cachedIndices.get(
    options as Fuse.IFuseOptions<unknown>
  );

  if (!indicesForOptions) {
    indicesForOptions = new WeakMap();
    cachedIndices.set(options as Fuse.IFuseOptions<unknown>, indicesForOptions);
  }

  let index = indicesForOptions.get(list);
  if (!index) {
    index = new Fuse<T>(list, options);
    indicesForOptions.set(list, index);
  }

  // Map's types don't allow us to specify that the type of the value depends on the
  // type of the key, so we have to cast it here.
  return index as unknown as Fuse<T>;
}

export const fuseGetFnRemoveDiacritics: Fuse.FuseGetFunction<unknown> = (
  ...args
) => {
  const text = Fuse.config.getFn(...args);
  if (!text) {
    return text;
  }

  if (typeof text === 'string') {
    return removeDiacritics(text);
  }

  return text.map(removeDiacritics);
};
