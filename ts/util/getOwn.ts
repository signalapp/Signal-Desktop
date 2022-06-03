// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { has } from 'lodash';

export function getOwn<TObject extends object, TKey extends keyof TObject>(
  obj: TObject,
  key: TKey
): TObject[TKey] | undefined {
  return has(obj, key) ? obj[key] : undefined;
}
