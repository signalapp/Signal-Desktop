// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function makeLookup<T>(
  items: ReadonlyArray<T>,
  key: keyof T
): Record<string, T> {
  return (items || []).reduce((lookup, item) => {
    if (item !== undefined && item[key] !== undefined) {
      // The force cast is necessary if we want the keyof T above, and the flexibility
      //   to pass anything in. And of course we're modifying a parameter!
      // eslint-disable-next-line no-param-reassign
      lookup[String(item[key])] = item;
    }
    return lookup;
  }, {} as Record<string, T>);
}
