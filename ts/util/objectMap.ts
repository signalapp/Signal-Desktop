// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function objectMap<T, R>(
  obj: Record<string, T>,
  f: (key: keyof typeof obj, value: (typeof obj)[keyof typeof obj]) => R
): Array<R> {
  const keys: Array<keyof typeof obj> = Object.keys(obj);
  return keys.map(key => f(key, obj[key]));
}
