// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export const version = 1140;

export function updateToSchemaVersion1140(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1140) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      DROP INDEX IF EXISTS callLinks_deleted;

      ALTER TABLE callLinks
        ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX callLinks_deleted
        ON callLinks (deleted, roomId);
    `);

    db.pragma('user_version = 1140');
  })();
  logger.info('updateToSchemaVersion1140: success!');
}
