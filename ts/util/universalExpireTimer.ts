// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export const ITEM_NAME = 'universalExpireTimer';

export function get(): number {
  return window.storage.get(ITEM_NAME) || 0;
}

export function set(newValue: number | undefined): Promise<void> {
  return window.storage.put(ITEM_NAME, newValue || 0);
}
