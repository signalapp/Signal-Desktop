// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log';
import { profileService } from '../services/profiles';
import type { ServiceIdString } from '../types/ServiceId';

const log = createLogger('getProfile');

export async function getProfile({
  serviceId,
  e164,
  groupId,
}: {
  serviceId: ServiceIdString | null;
  e164: string | null;
  groupId: string | null;
}): Promise<void> {
  const c = window.ConversationController.lookupOrCreate({
    serviceId,
    e164,
    reason: 'getProfile',
  });
  if (!c) {
    log.error('failed to find conversation; doing nothing');
    return;
  }

  return profileService.get(c.id, groupId);
}
