// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import { getMessageQueueTime } from '../../util/getMessageQueueTime.dom.ts';
import { createExpiringEntityCleanupService } from './createExpiringEntityCleanupService.std.ts';
import * as RemoteConfig from '../../RemoteConfig.dom.ts';

export const defunctCallLinkCleanupService = createExpiringEntityCleanupService(
  {
    logPrefix: 'DefunctCallLink',
    getNextExpiringEntity: async () => {
      const item = await DataReader.getTimestampOfOldestDefunctCallLink();
      if (!item) {
        return null;
      }

      const messageQueueTime = getMessageQueueTime();
      const expiresAtMs = item.addedAt + messageQueueTime;
      return { id: item.roomId, expiresAtMs };
    },
    cleanupExpiredEntities: async () => {
      const messageQueueTime = getMessageQueueTime();
      const ids =
        await DataWriter.deleteExpiredDefunctCallLinks(messageQueueTime);
      return ids;
    },
    subscribeToTriggers: trigger => {
      let prevMessageQueueTime = getMessageQueueTime();
      return RemoteConfig.onChange(['global.messageQueueTimeInSeconds'], () => {
        const messageQueueTime = getMessageQueueTime();
        if (messageQueueTime !== prevMessageQueueTime) {
          trigger('messageQueueTime changed');
        }
        prevMessageQueueTime = getMessageQueueTime();
      });
    },
  }
);
