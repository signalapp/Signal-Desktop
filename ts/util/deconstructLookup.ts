// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getOwn } from './getOwn.std.js';
import { assertDev } from './assert.std.js';

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
      assertDev(false, `deconstructLookup: lookup failed for ${key}; dropping`);
    }
  });
  return result;
};
