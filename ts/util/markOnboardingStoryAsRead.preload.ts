// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { isNotNil } from './isNotNil.std.ts';
import { DurationInSeconds } from './durations/index.std.ts';
import { markViewed } from '../services/MessageUpdater.preload.ts';
import { storageServiceUploadJob } from '../services/storage.preload.ts';
import { postSaveUpdates } from './cleanup.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

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
