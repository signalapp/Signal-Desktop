// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const areObjectEntriesEqual = <T>(
  a: Readonly<T>,
  b: Readonly<T>,
  keys: ReadonlyArray<keyof T>
): boolean => a === b || keys.every(key => a[key] === b[key]);
