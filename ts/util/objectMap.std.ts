// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function objectMap<T, R>(
  obj: Record<string, T>,
  f: (key: keyof typeof obj, value: (typeof obj)[keyof typeof obj]) => R
): Array<R> {
  return Object.entries(obj).map(([key, value]) => f(key, value));
}
