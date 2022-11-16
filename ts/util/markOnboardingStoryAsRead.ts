// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getMessageById } from '../messages/getMessageById';
import { isNotNil } from './isNotNil';
import { DurationInSeconds } from './durations';
import { markViewed } from '../services/MessageUpdater';
import { storageServiceUploadJob } from '../services/storage';

export async function markOnboardingStoryAsRead(): Promise<void> {
  const existingOnboardingStoryMessageIds = window.storage.get(
    'existingOnboardingStoryMessageIds'
  );

  if (!existingOnboardingStoryMessageIds) {
    return;
  }

  const messages = await Promise.all(
    existingOnboardingStoryMessageIds.map(getMessageById)
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

  window.Signal.Data.saveMessages(messageAttributes, {
    ourUuid: window.textsecure.storage.user.getCheckedUuid().toString(),
  });

  window.storage.put('hasViewedOnboardingStory', true);

  storageServiceUploadJob();
}
