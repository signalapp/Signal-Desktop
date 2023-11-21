// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MessageReceiptType } from './MessageReceipts';

// This function is necessary because the only thing we can guarantee will be unique is
//  three pieces of data: sender, deviceId, and timestamp.
// Because we don't care which device interacted with our message, we collapse this down
//  to: sender + timestamp.
// In some cases, modifiers are stored in the same map, so we also add the modifier type

type ModifierType = MessageReceiptType | 'readsync' | 'viewsync';

export function generateCacheKey({
  sender,
  timestamp,
  type,
}: {
  sender: string;
  timestamp: number;
  type: ModifierType;
}): string {
  return `cacheKey-${sender}-${timestamp}-${type}`;
}
