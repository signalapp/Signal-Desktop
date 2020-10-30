// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Matching window.storage.put API
// eslint-disable-next-line max-len
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function put(key: string, value: any): void {
  window.storage.put(key, value);
}

export async function remove(key: string): Promise<void> {
  await window.storage.remove(key);
}
