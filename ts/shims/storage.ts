// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { StorageAccessType } from '../types/Storage.d';

// Matching window.storage.put API
export function put<K extends keyof StorageAccessType>(
  key: K,
  value: StorageAccessType[K]
): void {
  window.storage.put(key, value);
}

export async function remove(key: keyof StorageAccessType): Promise<void> {
  await window.storage.remove(key);
}
