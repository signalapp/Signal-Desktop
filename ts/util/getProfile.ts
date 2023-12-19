// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { profileService } from '../services/profiles';
import type { ServiceIdString } from '../types/ServiceId';

export async function getProfile(
  serviceId?: ServiceIdString,
  e164?: string
): Promise<void> {
  const c = window.ConversationController.lookupOrCreate({
    serviceId,
    e164,
    reason: 'getProfile',
  });
  if (!c) {
    log.error('getProfile: failed to find conversation; doing nothing');
    return;
  }

  return profileService.get(c.id);
}
