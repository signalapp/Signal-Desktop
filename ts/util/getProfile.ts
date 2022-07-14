// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { profileService } from '../services/profiles';

export async function getProfile(
  providedUuid?: string,
  providedE164?: string
): Promise<void> {
  const id = window.ConversationController.ensureContactIds({
    uuid: providedUuid,
    e164: providedE164,
  });
  const c = window.ConversationController.get(id);
  if (!c) {
    log.error('getProfile: failed to find conversation; doing nothing');
    return;
  }

  return profileService.get(c.id);
}
