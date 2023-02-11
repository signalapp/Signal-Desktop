// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isEqual } from 'lodash';

export function memoizeByThis<Owner extends Record<string, unknown>, Result>(
  fn: () => Result
): () => Result {
  const lastValueMap = new WeakMap<Owner, Result>();
  return function memoizedFn(this: Owner): Result {
    const lastValue = lastValueMap.get(this);
    const newValue = fn();
    if (lastValue !== undefined && isEqual(lastValue, newValue)) {
      return lastValue;
    }

    lastValueMap.set(this, newValue);
    return newValue;
  };
}
