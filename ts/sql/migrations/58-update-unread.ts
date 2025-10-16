// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';
import { SeenStatus } from '../../MessageSeenStatus.std.js';

export default function updateToSchemaVersion58(db: Database): void {
  db.exec(
    `
    --- Promote unread status in JSON to SQL column

    -- NOTE: This was disabled because the 'unread' json field was deprecated
    -- in b0750e5f4e1f79f0f177b17cbe06d688431f948d, but the old value was kept
    -- in the messages created before the release of that commit.
    --
    -- UPDATE messages
    --   SET
    --     readStatus = ${ReadStatus.Unread},
    --     seenStatus = ${SeenStatus.Unseen}
    --   WHERE
    --     json_extract(json, '$.unread') IS true OR
    --     json_extract(json, '$.unread') IS 1;

    --- Clean up all old messages that still have a null read status
    ---   Note: we don't need to update seenStatus, because that was defaulted to zero

    UPDATE messages
      SET
        readStatus = ${ReadStatus.Read}
      WHERE
        readStatus IS NULL;

    --- Re-run unseen/unread queries from migration 56

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

    --- (new) Ensure these message types are not unread, just unseen

    UPDATE messages
      SET
        readStatus = ${ReadStatus.Read}
      WHERE
        readStatus = ${ReadStatus.Unread} AND
        (
          type IN (
            'change-number-notification',
            'keychange'
          )
        );

    --- (new) Ensure that these message types are neither unseen nor unread

    UPDATE messages
      SET
        readStatus = ${ReadStatus.Read},
        seenStatus = ${SeenStatus.Seen}
      WHERE
        type IN (
          'group-v1-migration',
          'message-history-unsynced',
          'outgoing',
          'profile-change',
          'universal-timer-notification'
        );

    --- Make sure JSON reflects SQL columns

    UPDATE messages
      SET
        json = json_patch(
          json,
          json_object(
            'readStatus', readStatus,
            'seenStatus', seenStatus
          )
        )
      WHERE
        readStatus IS NOT NULL OR
        seenStatus IS NOT 0;
    `
  );
}
