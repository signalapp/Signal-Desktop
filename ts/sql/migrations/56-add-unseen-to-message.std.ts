// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';
import { SeenStatus } from '../../MessageSeenStatus.std.js';

export default function updateToSchemaVersion56(db: Database): void {
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
}
