// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { profileService } from '../services/profiles';

export async function getProfile(uuid?: string, e164?: string): Promise<void> {
  const c = window.ConversationController.lookupOrCreate({
    uuid,
    e164,
  });
  if (!c) {
    log.error('getProfile: failed to find conversation; doing nothing');
    return;
  }

  return profileService.get(c.id);
}
