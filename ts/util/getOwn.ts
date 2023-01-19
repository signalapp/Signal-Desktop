// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function getOwn<TObject extends object, TKey extends keyof TObject>(
  obj: TObject,
  key: TKey
): TObject[TKey] | undefined {
  return Object.hasOwn(obj, key) ? obj[key] : undefined;
}
