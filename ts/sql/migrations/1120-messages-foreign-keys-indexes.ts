// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 1120;

export function updateToSchemaVersion1120(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1120) {
    return;
  }

  db.transaction(() => {
    /** Adds indexes for all tables with foreign key relationships to messages(id) */
    db.exec(`
      CREATE INDEX edited_messages_messageId
        ON edited_messages(messageId);

      CREATE INDEX mentions_messageId
        ON mentions(messageId);
    `);

    db.pragma('user_version = 1120');
  })();

  logger.info('updateToSchemaVersion1120: success!');
}
