// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.js';
import { DataWriter } from '../sql/Client.js';
import { getMessageById } from '../messages/getMessageById.js';
import { isNotNil } from './isNotNil.js';
import { DurationInSeconds } from './durations/index.js';
import { markViewed } from '../services/MessageUpdater.js';
import { storageServiceUploadJob } from '../services/storage.js';
import { postSaveUpdates } from './cleanup.js';

const log = createLogger('markOnboardingStoryAsRead');

export async function markOnboardingStoryAsRead(): Promise<boolean> {
  const existingOnboardingStoryMessageIds = window.storage.get(
    'existingOnboardingStoryMessageIds'
  );

  if (!existingOnboardingStoryMessageIds) {
    log.warn('no existing messages');
    return false;
  }

  const messages = await Promise.all(
    existingOnboardingStoryMessageIds.map(id => getMessageById(id))
  );

  const storyReadDate = Date.now();

  const messageAttributes = messages
    .map(message => {
      if (!message) {
        return;
      }

      message.set({
        expireTimer: DurationInSeconds.DAY,
      });

      message.set(markViewed(message.attributes, storyReadDate));

      return message.attributes;
    })
    .filter(isNotNil);

  log.info(`marked ${messageAttributes.length} viewed`);

  await DataWriter.saveMessages(messageAttributes, {
    ourAci: window.textsecure.storage.user.getCheckedAci(),
    postSaveUpdates,
  });

  await window.storage.put('hasViewedOnboardingStory', true);

  storageServiceUploadJob({ reason: 'markOnboardingStoryAsRead' });

  return true;
}
