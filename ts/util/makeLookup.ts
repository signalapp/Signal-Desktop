// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fromPairs, map } from 'lodash';

export function makeLookup<T>(
  items: Array<T>,
  key: keyof T
): { [key: string]: T } {
  const pairs = map(items, item => [item[key], item]);

  return fromPairs(pairs);
}
