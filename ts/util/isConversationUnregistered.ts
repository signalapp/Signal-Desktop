// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isMoreRecentThan, isOlderThan } from './timestamp';
import { HOUR, MONTH } from './durations';

const SIX_HOURS = 6 * HOUR;

export function isConversationEverUnregistered({
  discoveredUnregisteredAt,
}: Readonly<{ discoveredUnregisteredAt?: number }>): boolean {
  return discoveredUnregisteredAt !== undefined;
}

export function isConversationUnregistered({
  discoveredUnregisteredAt,
}: Readonly<{ discoveredUnregisteredAt?: number }>): boolean {
  return Boolean(
    discoveredUnregisteredAt &&
      isMoreRecentThan(discoveredUnregisteredAt, SIX_HOURS)
  );
}

export function isConversationUnregisteredAndStale({
  firstUnregisteredAt,
}: Readonly<{ firstUnregisteredAt?: number }>): boolean {
  return Boolean(
    firstUnregisteredAt && isOlderThan(firstUnregisteredAt, MONTH)
  );
}
