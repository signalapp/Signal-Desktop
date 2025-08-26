// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { DataReader, DataWriter } from '../../sql/Client';
import { getMessageQueueTime } from '../../util/getMessageQueueTime';
import { createExpiringEntityCleanupService } from './createExpiringEntityCleanupService';
import * as RemoteConfig from '../../RemoteConfig';

export const chatFolderCleanupService = createExpiringEntityCleanupService({
  logPrefix: 'ChatFolders',
  getNextExpiringEntity: async () => {
    const oldestDeletedChatFolder =
      await DataReader.getOldestDeletedChatFolder();
    if (oldestDeletedChatFolder == null) {
      return null;
    }
    const messageQueueTime = getMessageQueueTime();
    const expiresAtMs =
      oldestDeletedChatFolder.deletedAtTimestampMs + messageQueueTime;
    return { id: oldestDeletedChatFolder.id, expiresAtMs };
  },
  cleanupExpiredEntities: async () => {
    const messageQueueTime = getMessageQueueTime();
    const deletedChatFolderIds =
      await DataWriter.deleteExpiredChatFolders(messageQueueTime);
    return deletedChatFolderIds;
  },
  subscribeToTriggers: trigger => {
    let prevMessageQueueTime = getMessageQueueTime();
    return RemoteConfig.onChange('global.messageQueueTimeInSeconds', () => {
      const messageQueueTime = getMessageQueueTime();
      if (messageQueueTime !== prevMessageQueueTime) {
        trigger('messageQueueTime changed');
      }
      prevMessageQueueTime = getMessageQueueTime();
    });
  },
});
