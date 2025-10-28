// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorageAccessType } from '../types/Storage.d.ts';
import { itemStorage } from '../textsecure/Storage.preload.js';

// Matching storage.put API
export async function put<K extends keyof StorageAccessType>(
  key: K,
  value: StorageAccessType[K]
): Promise<void> {
  await itemStorage.put(key, value);
}

export async function remove(key: keyof StorageAccessType): Promise<void> {
  await itemStorage.remove(key);
}
