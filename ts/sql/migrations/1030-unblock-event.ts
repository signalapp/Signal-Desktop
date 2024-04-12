// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { sql, sqlFragment } from '../util';

export const version = 1030;

export function updateToSchemaVersion1030(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1030) {
    return;
  }

  db.transaction(() => {
    // From migration 81
    const shouldAffectActivityOrPreview = sqlFragment`
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
      AND NOT (
        type IS 'message-request-response-event'
        AND json_extract(json, '$.messageRequestResponseEvent') IN ('ACCEPT', 'BLOCK', 'UNBLOCK')
      )
    `;

    const [updateShouldAffectPreview] = sql`
      --- These will be re-added below
      DROP INDEX messages_preview;
      DROP INDEX messages_preview_without_story;
      DROP INDEX messages_activity;
      DROP INDEX message_user_initiated;

      --- These will also be re-added below
      ALTER TABLE messages DROP COLUMN shouldAffectActivity;
      ALTER TABLE messages DROP COLUMN shouldAffectPreview;

      --- (change: added message-request-response-event->ACCEPT/BLOCK/UNBLOCK)
      ALTER TABLE messages
        ADD COLUMN shouldAffectPreview INTEGER
        GENERATED ALWAYS AS (${shouldAffectActivityOrPreview});
      ALTER TABLE messages
        ADD COLUMN shouldAffectActivity INTEGER
        GENERATED ALWAYS AS (${shouldAffectActivityOrPreview});

      --- From migration 88
      CREATE INDEX messages_preview ON messages
        (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
         received_at, sent_at);

      --- From migration 88
      CREATE INDEX messages_preview_without_story ON messages
        (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
         received_at, sent_at) WHERE storyId IS NULL;

      --- From migration 88
      CREATE INDEX messages_activity ON messages
        (conversationId, shouldAffectActivity, isTimerChangeFromSync,
         isGroupLeaveEventFromOther, received_at, sent_at);

      --- From migration 81
      CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);
    `;

    db.exec(updateShouldAffectPreview);

    db.pragma('user_version = 1030');
  })();

  logger.info('updateToSchemaVersion1030: success!');
}
