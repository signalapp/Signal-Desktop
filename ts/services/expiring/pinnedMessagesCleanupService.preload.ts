// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { createExpiringEntityCleanupService } from './createExpiringEntityCleanupService.std.js';
import { strictAssert } from '../../util/assert.std.js';
import {
  conversationJobQueue,
  conversationQueueJobEnum,
} from '../../jobs/conversationJobQueue.preload.js';
import { getPinnedMessageTarget } from '../../util/getPinMessageTarget.preload.js';
import { drop } from '../../util/drop.std.js';

export const pinnedMessagesCleanupService = createExpiringEntityCleanupService({
  logPrefix: 'PinnedMessages',
  getNextExpiringEntity: async () => {
    const nextExpiringPinnedMessage =
      await DataReader.getNextExpiringPinnedMessageAcrossConversations();
    if (nextExpiringPinnedMessage == null) {
      return null;
    }
    strictAssert(
      nextExpiringPinnedMessage.expiresAt != null,
      'nextExpiringPinnedMessage.expiresAt is null'
    );
    return {
      id: nextExpiringPinnedMessage.id,
      expiresAtMs: nextExpiringPinnedMessage.expiresAt,
    };
  },
  cleanupExpiredEntities: async () => {
    const deletedPinnedMessages =
      await DataWriter.deleteAllExpiredPinnedMessagesBefore(Date.now());
    const unpinnedAt = Date.now();
    const deletedPinnedMessagesIds = [];
    const changedConversationIds = new Set<string>();

    for (const pinnedMessage of deletedPinnedMessages) {
      deletedPinnedMessagesIds.push(pinnedMessage.id);
      changedConversationIds.add(pinnedMessage.conversationId);
      // Add to conversation queue without waiting
      drop(sendUnpinSync(pinnedMessage.messageId, unpinnedAt));
    }

    for (const conversationId of changedConversationIds) {
      window.reduxActions.conversations.onPinnedMessagesChanged(conversationId);
    }

    return deletedPinnedMessagesIds;
  },
  subscribeToTriggers: () => {
    return () => null;
  },
});

async function sendUnpinSync(targetMessageId: string, unpinnedAt: number) {
  const target = await getPinnedMessageTarget(targetMessageId);
  if (target == null) {
    return;
  }
  await conversationJobQueue.add({
    type: conversationQueueJobEnum.enum.UnpinMessage,
    ...target,
    unpinnedAt,
    isSyncOnly: true,
  });
}
