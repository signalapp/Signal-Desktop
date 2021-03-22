// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isMoreRecentThan } from './timestamp';

const SIX_HOURS = 1000 * 60 * 60 * 6;

export function isConversationUnregistered({
  discoveredUnregisteredAt,
}: Readonly<{ discoveredUnregisteredAt?: number }>): boolean {
  return Boolean(
    discoveredUnregisteredAt &&
      isMoreRecentThan(discoveredUnregisteredAt, SIX_HOURS)
  );
}
