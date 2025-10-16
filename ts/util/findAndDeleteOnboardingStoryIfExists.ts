// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { DataWriter } from '../sql/Client.preload.js';
import { calculateExpirationTimestamp } from './expirationTimer.std.js';
import { DAY } from './durations/index.std.js';
import { cleanupMessages } from './cleanup.preload.js';
import { getMessageById } from '../messages/getMessageById.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('findAndDeleteOnboardingStoryIfExists');

export async function findAndDeleteOnboardingStoryIfExists(): Promise<void> {
  const existingOnboardingStoryMessageIds = itemStorage.get(
    'existingOnboardingStoryMessageIds'
  );

  if (!existingOnboardingStoryMessageIds) {
    return;
  }

  const hasExpired = await (async () => {
    const [storyId] = existingOnboardingStoryMessageIds;
    try {
      const message = await getMessageById(storyId);
      if (!message) {
        throw new Error(
          `findAndDeleteOnboardingStoryIfExists: Failed to find message ${storyId}`
        );
      }

      const expires = calculateExpirationTimestamp(message.attributes) ?? 0;

      const now = Date.now();
      const isExpired = expires < now;
      const needsRepair = expires > now + 2 * DAY;

      return isExpired || needsRepair;
    } catch {
      return true;
    }
  })();

  if (!hasExpired) {
    log.info('current msg has not expired');
    return;
  }

  log.info('removing onboarding stories');

  await DataWriter.removeMessages(existingOnboardingStoryMessageIds, {
    cleanupMessages,
  });

  await itemStorage.put('existingOnboardingStoryMessageIds', undefined);

  const signalConversation =
    await window.ConversationController.getOrCreateSignalConversation();

  existingOnboardingStoryMessageIds.forEach(messageId =>
    window.reduxActions.conversations.messageDeleted(
      messageId,
      signalConversation.id
    )
  );
}
