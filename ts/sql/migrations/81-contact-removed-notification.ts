// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion81(db: Database): void {
  db.exec(
    `
    --- These will be re-added below
    DROP INDEX messages_preview;
    DROP INDEX messages_preview_without_story;
    DROP INDEX messages_activity;
    DROP INDEX message_user_initiated;

    --- These will also be re-added below
    ALTER TABLE messages DROP COLUMN shouldAffectActivity;
    ALTER TABLE messages DROP COLUMN shouldAffectPreview;
    ALTER TABLE messages DROP COLUMN isUserInitiatedMessage;

    --- Note: These generated columns were previously modified in
    ---       migration 73, and are mostly the same

    --- (change: added contact-removed-notification)
    ALTER TABLE messages
      ADD COLUMN shouldAffectActivity INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'contact-removed-notification',
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

    --- (change: added contact-removed-notification)
    ALTER TABLE messages
      ADD COLUMN shouldAffectPreview INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'contact-removed-notification',
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

    --- (change: added contact-removed-notification)
    ALTER TABLE messages
      ADD COLUMN isUserInitiatedMessage INTEGER
      GENERATED ALWAYS AS (
        type IS NULL
        OR
        type NOT IN (
          'change-number-notification',
          'contact-removed-notification',
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

    --- From migration 76
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at);

    --- From migration 76
    CREATE INDEX messages_preview_without_story ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at) WHERE storyId IS NULL;

    --- From migration 73
    CREATE INDEX messages_activity ON messages
      (conversationId, shouldAffectActivity, isTimerChangeFromSync, isGroupLeaveEventFromOther, received_at, sent_at);

    --- From migration 74
    CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);
    `
  );
}
