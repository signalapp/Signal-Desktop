// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { isMoreRecentThan, isOlderThan } from './timestamp';
import { HOUR, MONTH } from './durations';

const SIX_HOURS = 6 * HOUR;

export function isConversationEverUnregistered({
  uuid,
  discoveredUnregisteredAt,
}: Readonly<{ uuid?: string; discoveredUnregisteredAt?: number }>): boolean {
  return !uuid || discoveredUnregisteredAt !== undefined;
}

export function isConversationUnregistered({
  uuid,
  discoveredUnregisteredAt,
}: Readonly<{ uuid?: string; discoveredUnregisteredAt?: number }>): boolean {
  return (
    !uuid ||
    Boolean(
      discoveredUnregisteredAt &&
        isMoreRecentThan(discoveredUnregisteredAt, SIX_HOURS)
    )
  );
}

export function isConversationUnregisteredAndStale({
  uuid,
  firstUnregisteredAt,
}: Readonly<{ uuid?: string; firstUnregisteredAt?: number }>): boolean {
  if (!uuid) {
    return true;
  }

  return Boolean(
    firstUnregisteredAt && isOlderThan(firstUnregisteredAt, MONTH)
  );
}
