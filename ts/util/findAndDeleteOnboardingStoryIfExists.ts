// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { calculateExpirationTimestamp } from './expirationTimer';
import { DAY } from './durations';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';

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
      const messageAttributes = await window.MessageCache.resolveAttributes(
        'findAndDeleteOnboardingStoryIfExists',
        storyId
      );

      const expires = calculateExpirationTimestamp(messageAttributes) ?? 0;

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

  await window.Signal.Data.removeMessages(existingOnboardingStoryMessageIds, {
    singleProtoJobQueue,
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
