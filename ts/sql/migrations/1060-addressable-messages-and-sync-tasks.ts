// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 1060;

export function updateToSchemaVersion1060(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1060) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE messages
        ADD COLUMN isAddressableMessage INTEGER
        GENERATED ALWAYS AS (
          type IS NULL
          OR
          type IN (
            'incoming',
            'outgoing'
          )
        );
     
      CREATE INDEX messages_by_date_addressable
        ON messages (
          conversationId, isAddressableMessage, received_at, sent_at
      );

      CREATE TABLE syncTasks(
        id TEXT PRIMARY KEY NOT NULL,
        attempts INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        data TEXT NOT NULL,
        envelopeId TEXT NOT NULL,
        sentAt INTEGER NOT NULL,
        type TEXT NOT NULL
      ) STRICT;

      CREATE INDEX syncTasks_order ON syncTasks (
        createdAt, sentAt, id
      )
    `);

    db.pragma('user_version = 1060');
  })();

  logger.info('updateToSchemaVersion1060: success!');
}
