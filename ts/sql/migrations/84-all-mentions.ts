// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion84(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 84) {
    return;
  }

  db.transaction(() => {
    const selectMentionsFromMessages = `
      SELECT messages.id, bodyRanges.value ->> 'mentionUuid' as mentionUuid, bodyRanges.value ->> 'start' as start, bodyRanges.value ->> 'length' as length 
      FROM messages, json_each(messages.json ->> 'bodyRanges') as bodyRanges
      WHERE bodyRanges.value ->> 'mentionUuid' IS NOT NULL
    `;

    db.exec(`
      DROP TABLE IF EXISTS mentions;

      CREATE TABLE mentions (
        messageId REFERENCES messages(id) ON DELETE CASCADE,
        mentionUuid STRING,
        start INTEGER,
        length INTEGER
      );

      CREATE INDEX mentions_uuid ON mentions (mentionUuid);

      INSERT INTO mentions (messageId, mentionUuid, start, length)
      ${selectMentionsFromMessages};

      -- Note: any changes to this trigger must be reflected in 
      -- Server.ts: enableMessageInsertTriggersAndBackfill
      CREATE TRIGGER messages_on_insert_insert_mentions AFTER INSERT ON messages
      BEGIN
        INSERT INTO mentions (messageId, mentionUuid, start, length)
        ${selectMentionsFromMessages} 
        AND messages.id = new.id;
      END;

      CREATE TRIGGER messages_on_update_update_mentions AFTER UPDATE ON messages
      BEGIN
        DELETE FROM mentions WHERE messageId = new.id;
        INSERT INTO mentions (messageId, mentionUuid, start, length)
        ${selectMentionsFromMessages} 
        AND messages.id = new.id;
      END;
    `);

    db.pragma('user_version = 84');
  })();

  logger.info('updateToSchemaVersion84: success!');
}
