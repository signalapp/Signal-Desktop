// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion46(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 46) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      --- Add column to messages table

      ALTER TABLE messages
      ADD COLUMN
      isStory INTEGER
      GENERATED ALWAYS
      AS (type = 'story');

      --- Update important message indices

      DROP INDEX   messages_conversation;
      CREATE INDEX messages_conversation ON messages
        (conversationId, isStory, storyId, received_at, sent_at);
      `
    );

    db.pragma('user_version = 46');
  })();

  logger.info('updateToSchemaVersion46: success!');
}
