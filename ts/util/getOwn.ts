// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { has } from 'lodash';

// We want this to work with any object, so we allow `object` here.
// eslint-disable-next-line @typescript-eslint/ban-types
export function getOwn<TObject extends object, TKey extends keyof TObject>(
  obj: TObject,
  key: TKey
): TObject[TKey] | undefined {
  return has(obj, key) ? obj[key] : undefined;
}
