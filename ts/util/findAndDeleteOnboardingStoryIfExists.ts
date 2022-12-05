// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { getMessageById } from '../messages/getMessageById';
import { calculateExpirationTimestamp } from './expirationTimer';

export async function findAndDeleteOnboardingStoryIfExists(): Promise<void> {
  const existingOnboardingStoryMessageIds = window.storage.get(
    'existingOnboardingStoryMessageIds'
  );

  if (!existingOnboardingStoryMessageIds) {
    return;
  }

  const hasExpired = await (async () => {
    for (const id of existingOnboardingStoryMessageIds) {
      // eslint-disable-next-line no-await-in-loop
      const message = await getMessageById(id);
      if (!message) {
        continue;
      }

      const expires = calculateExpirationTimestamp(message.attributes) ?? 0;

      return expires < Date.now();
    }

    return true;
  })();

  if (!hasExpired) {
    log.info(
      'findAndDeleteOnboardingStoryIfExists: current msg has not expired'
    );
    return;
  }

  log.info('findAndDeleteOnboardingStoryIfExists: removing onboarding stories');

  await window.Signal.Data.removeMessages(existingOnboardingStoryMessageIds);

  window.storage.put('existingOnboardingStoryMessageIds', undefined);

  const signalConversation =
    await window.ConversationController.getOrCreateSignalConversation();

  existingOnboardingStoryMessageIds.forEach(messageId =>
    window.reduxActions.conversations.messageDeleted(
      messageId,
      signalConversation.id
    )
  );
}
