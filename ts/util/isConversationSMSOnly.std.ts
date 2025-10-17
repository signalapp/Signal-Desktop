// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId.std.js';

export type MinimalConversationType = Readonly<{
  discoveredUnregisteredAt?: number;
  e164?: string;
  serviceId?: ServiceIdString;
  type?: string;
}>;

export function isConversationSMSOnly(
  conversation: MinimalConversationType
): boolean {
  const { e164, serviceId, type } = conversation;

  // `direct` for redux, `private` for models and the database
  if (type !== 'direct' && type !== 'private') {
    return false;
  }

  if (serviceId) {
    return false;
  }

  if (!e164) {
    return false;
  }

  return true;
}
