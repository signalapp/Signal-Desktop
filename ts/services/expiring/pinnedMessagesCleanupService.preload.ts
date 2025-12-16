// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader, DataWriter } from '../../sql/Client.preload.js';
import { createExpiringEntityCleanupService } from './createExpiringEntityCleanupService.std.js';
import { strictAssert } from '../../util/assert.std.js';

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
    const deletedPinnedMessagesIds =
      await DataWriter.deleteAllExpiredPinnedMessagesBefore(Date.now());
    return deletedPinnedMessagesIds;
  },
  subscribeToTriggers: () => {
    return () => null;
  },
});
