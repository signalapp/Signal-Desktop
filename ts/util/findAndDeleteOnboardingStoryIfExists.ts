// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { DataWriter } from '../sql/Client';
import { calculateExpirationTimestamp } from './expirationTimer';
import { DAY } from './durations';
import { cleanupMessages } from './cleanup';
import { getMessageById } from '../messages/getMessageById';

export async function findAndDeleteOnboardingStoryIfExists(): Promise<void> {
  const existingOnboardingStoryMessageIds = window.storage.get(
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
    log.info(
      'findAndDeleteOnboardingStoryIfExists: current msg has not expired'
    );
    return;
  }

  log.info('findAndDeleteOnboardingStoryIfExists: removing onboarding stories');

  await DataWriter.removeMessages(existingOnboardingStoryMessageIds, {
    cleanupMessages,
  });

  await window.storage.put('existingOnboardingStoryMessageIds', undefined);

  const signalConversation =
    await window.ConversationController.getOrCreateSignalConversation();

  existingOnboardingStoryMessageIds.forEach(messageId =>
    window.reduxActions.conversations.messageDeleted(
      messageId,
      signalConversation.id
    )
  );
}
