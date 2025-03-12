// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion80(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 80) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      CREATE TABLE edited_messages(
        fromId STRING,
        messageId STRING REFERENCES messages(id)
          ON DELETE CASCADE,
        sentAt INTEGER,
        readStatus INTEGER
      );

      CREATE INDEX edited_messages_sent_at ON edited_messages (sentAt);
    `);

    db.pragma('user_version = 80');
  })();

  logger.info('updateToSchemaVersion80: success!');
}
