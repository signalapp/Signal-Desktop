// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId.std.ts';
import { isMoreRecentThan, isOlderThan } from './timestamp.std.ts';
import { HOUR } from './durations/index.std.ts';
import { getMessageQueueTime } from './getMessageQueueTime.dom.ts';

const SIX_HOURS = 6 * HOUR;

export function isConversationEverUnregistered({
  serviceId,
  discoveredUnregisteredAt,
}: Readonly<{
  serviceId?: ServiceIdString;
  discoveredUnregisteredAt?: number;
}>): boolean {
  return !serviceId || discoveredUnregisteredAt !== undefined;
}

export function isConversationUnregistered({
  serviceId,
  discoveredUnregisteredAt,
}: Readonly<{
  serviceId?: ServiceIdString;
  discoveredUnregisteredAt?: number;
}>): boolean {
  return (
    !serviceId ||
    Boolean(
      discoveredUnregisteredAt &&
      isMoreRecentThan(discoveredUnregisteredAt, SIX_HOURS)
    )
  );
}

export function isConversationUnregisteredAndStale({
  serviceId,
  firstUnregisteredAt,
}: Readonly<{
  serviceId?: ServiceIdString;
  firstUnregisteredAt?: number;
}>): boolean {
  if (!serviceId) {
    return true;
  }

  return Boolean(
    firstUnregisteredAt &&
    isOlderThan(firstUnregisteredAt, getMessageQueueTime())
  );
}
