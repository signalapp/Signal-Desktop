// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getOwn } from './getOwn';
import { assert } from './assert';

export const deconstructLookup = <T>(
  lookup: Record<string, T>,
  keys: ReadonlyArray<string>
): Array<T> => {
  const result: Array<T> = [];
  keys.forEach((key: string) => {
    const value = getOwn(lookup, key);
    if (value) {
      result.push(value);
    } else {
      assert(false, `deconstructLookup: lookup failed for ${key}; dropping`);
    }
  });
  return result;
};
