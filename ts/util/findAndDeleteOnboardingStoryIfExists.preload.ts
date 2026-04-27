// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { calculateExpirationTimestamp } from './expirationTimer.std.ts';
import { DAY } from './durations/index.std.ts';
import { cleanupMessages } from './cleanup.preload.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

const log = createLogger('findAndDeleteOnboardingStoryIfExists');

export async function findAndDeleteOnboardingStoryIfExists(): Promise<void> {
  const existingOnboardingStoryMessageIds = itemStorage.get(
    'existingOnboardingStoryMessageIds'
  );

  if (!existingOnboardingStoryMessageIds) {
    return;
  }

  const hasExpired = await (async () => {
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const storyId = existingOnboardingStoryMessageIds[0]!;
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

  await DataWriter.removeMessagesById(existingOnboardingStoryMessageIds, {
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
