// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This function is necessary because the only thing we can guarantee will be unique is
//  three pieces of data: sender, deviceId, and timestamp.
// Because we don't care which device interacted with our message, we collapse this down
//  to: sender + timestamp.
export function generateCacheKey({
  sender,
  timestamp,
}: {
  sender: string;
  timestamp: number;
}): string {
  return `cacheKey-${sender}-${timestamp}`;
}
