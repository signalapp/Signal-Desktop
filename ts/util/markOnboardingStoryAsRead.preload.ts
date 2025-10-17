// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { DataWriter } from '../sql/Client.preload.js';
import { getMessageById } from '../messages/getMessageById.preload.js';
import { isNotNil } from './isNotNil.std.js';
import { DurationInSeconds } from './durations/index.std.js';
import { markViewed } from '../services/MessageUpdater.preload.js';
import { storageServiceUploadJob } from '../services/storage.preload.js';
import { postSaveUpdates } from './cleanup.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('markOnboardingStoryAsRead');

export async function markOnboardingStoryAsRead(): Promise<boolean> {
  const existingOnboardingStoryMessageIds = itemStorage.get(
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
    ourAci: itemStorage.user.getCheckedAci(),
    postSaveUpdates,
  });

  await itemStorage.put('hasViewedOnboardingStory', true);

  storageServiceUploadJob({ reason: 'markOnboardingStoryAsRead' });

  return true;
}
