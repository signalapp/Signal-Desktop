// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion56(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 56) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      --- Add column to messages table

      ALTER TABLE messages ADD COLUMN seenStatus NUMBER default 0;

      --- Add index to make searching on this field easy

      CREATE INDEX messages_unseen_no_story ON messages
        (conversationId, seenStatus, isStory, received_at, sent_at)
        WHERE
          seenStatus IS NOT NULL;

      CREATE INDEX messages_unseen_with_story ON messages
        (conversationId, seenStatus, isStory, storyId, received_at, sent_at)
        WHERE
          seenStatus IS NOT NULL;

      --- Update seenStatus to UnseenStatus.Unseen for certain messages
      --- (NULL included because 'timer-notification' in 1:1 convos had type = NULL)

      UPDATE messages
        SET
          seenStatus = ${SeenStatus.Unseen}
        WHERE
          readStatus = ${ReadStatus.Unread} AND
          (
            type IS NULL
            OR
            type IN (
              'call-history',
              'change-number-notification',
              'chat-session-refreshed',
              'delivery-issue',
              'group',
              'incoming',
              'keychange',
              'timer-notification',
              'verified-change'
            )
          );

      --- Set readStatus to ReadStatus.Read for all other message types

      UPDATE messages
        SET
          readStatus = ${ReadStatus.Read}
        WHERE
          readStatus = ${ReadStatus.Unread} AND
          type IS NOT NULL AND
          type NOT IN (
            'call-history',
            'change-number-notification',
            'chat-session-refreshed',
            'delivery-issue',
            'group',
            'incoming',
            'keychange',
            'timer-notification',
            'verified-change'
          );
      `
    );

    db.pragma('user_version = 56');
  })();

  logger.info('updateToSchemaVersion56: success!');
}
