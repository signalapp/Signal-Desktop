// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { getOurUuid } from './41-uuid-keys';
import type { WritableDB } from '../Interface';
import type { Query } from '../util';

export default function updateToSchemaVersion47(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 47) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX   messages_conversation;

      ALTER TABLE messages
        DROP COLUMN isStory;
      ALTER TABLE messages
        ADD COLUMN isStory INTEGER
        GENERATED ALWAYS AS (type IS 'story');

      ALTER TABLE messages
        ADD COLUMN isChangeCreatedByUs INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE messages
        ADD COLUMN shouldAffectActivity INTEGER
        GENERATED ALWAYS AS (
          type IS NULL
          OR
          type NOT IN (
            'change-number-notification',
            'group-v1-migration',
            'message-history-unsynced',
            'profile-change',
            'story',
            'universal-timer-notification',
            'verified-change',

            'keychange'
          )
        );

      ALTER TABLE messages
        ADD COLUMN shouldAffectPreview INTEGER
        GENERATED ALWAYS AS (
          type IS NULL
          OR
          type NOT IN (
            'change-number-notification',
            'group-v1-migration',
            'message-history-unsynced',
            'profile-change',
            'story',
            'universal-timer-notification',
            'verified-change'
          )
        );

      ALTER TABLE messages
        ADD COLUMN isUserInitiatedMessage INTEGER
        GENERATED ALWAYS AS (
          type IS NULL
          OR
          type NOT IN (
            'change-number-notification',
            'group-v1-migration',
            'message-history-unsynced',
            'profile-change',
            'story',
            'universal-timer-notification',
            'verified-change',

            'group-v2-change',
            'keychange'
          )
        );

      ALTER TABLE messages
        ADD COLUMN isTimerChangeFromSync INTEGER
        GENERATED ALWAYS AS (
          json_extract(json, '$.expirationTimerUpdate.fromSync') IS 1
        );

      ALTER TABLE messages
        ADD COLUMN isGroupLeaveEvent INTEGER
        GENERATED ALWAYS AS (
          type IS 'group-v2-change' AND
          json_array_length(json_extract(json, '$.groupV2Change.details')) IS 1 AND
          json_extract(json, '$.groupV2Change.details[0].type') IS 'member-remove' AND
          json_extract(json, '$.groupV2Change.from') IS NOT NULL AND
          json_extract(json, '$.groupV2Change.from') IS json_extract(json, '$.groupV2Change.details[0].uuid')
        );

      ALTER TABLE messages
        ADD COLUMN isGroupLeaveEventFromOther INTEGER
        GENERATED ALWAYS AS (
          isGroupLeaveEvent IS 1
          AND
          isChangeCreatedByUs IS 0
        );

      CREATE INDEX messages_conversation ON messages
        (conversationId, isStory, storyId, received_at, sent_at);

      CREATE INDEX messages_preview ON messages
        (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, expiresAt, received_at, sent_at);

      CREATE INDEX messages_activity ON messages
        (conversationId, shouldAffectActivity, isTimerChangeFromSync, isGroupLeaveEventFromOther, received_at, sent_at);

      CREATE INDEX message_user_initiated ON messages (isUserInitiatedMessage);
      `
    );

    const ourUuid = getOurUuid(db);
    if (!ourUuid) {
      logger.info('updateToSchemaVersion47: our UUID not found');
    } else {
      db.prepare<Query>(
        `
        UPDATE messages SET
          isChangeCreatedByUs = json_extract(json, '$.groupV2Change.from') IS $ourUuid;
        `
      ).run({
        ourUuid,
      });
    }

    db.pragma('user_version = 47');
  })();

  logger.info('updateToSchemaVersion47: success!');
}
