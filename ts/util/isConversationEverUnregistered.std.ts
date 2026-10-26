// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId.std.ts';

export function isConversationEverUnregistered({
  serviceId,
  discoveredUnregisteredAt,
}: Readonly<{
  serviceId?: ServiceIdString;
  discoveredUnregisteredAt?: number;
}>): boolean {
  return !serviceId || discoveredUnregisteredAt !== undefined;
}
