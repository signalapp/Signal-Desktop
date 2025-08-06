// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion73(db: Database): void {
  db.exec(
    `
    --- Delete deprecated notifications
    DELETE FROM messages WHERE type IS 'phone-number-discovery';

    --- These will be re-added below
    DROP INDEX messages_preview;
    DROP INDEX messages_activity;
    DROP INDEX message_user_initiated;

    --- These will also be re-added below
    ALTER TABLE messages DROP COLUMN shouldAffectActivity;
    ALTER TABLE messages DROP COLUMN shouldAffectPreview;
    ALTER TABLE messages DROP COLUMN isUserInitiatedMessage;

    --- Note: These generated columns were originally introduced in migration 71, and
    ---       are mostly the same

    --- (change: removed phone-number-discovery)
    ALTER TABLE messages
      ADD COLUMN shouldAffectActivity INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- (change: removed phone-number-discovery
    ---    (now matches the above list)
    ALTER TABLE messages
      ADD COLUMN shouldAffectPreview INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    --- Note: This list only differs from the above on these types:
    ---   group-v2-change

    --- (change: removed phone-number-discovery
    ALTER TABLE messages
      ADD COLUMN isUserInitiatedMessage INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'conversation-merge',
          'group-v1-migration',
          'group-v2-change',
          'keychange',
          'message-history-unsynced',
          'profile-change',
          'story',
          'universal-timer-notification',
          'verified-change'
        )
      );

    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, expiresAt, received_at, sent_at);

    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync, isGroupLeaveEventFromOther, received_at, sent_at);

    CREATE INDEX message_user_initiated ON messages (isUserInitiatedMessage);
    `
  );
}
