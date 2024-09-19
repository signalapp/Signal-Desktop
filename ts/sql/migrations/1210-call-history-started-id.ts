// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export const version = 1210;
export function updateToSchemaVersion1210(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1210) {
    return;
  }

  db.transaction(() => {
    // The standard getNextAttachmentDownloadJobs query uses active & source conditions,
    // ordered by received_at
    db.exec(`
      ALTER TABLE callsHistory
        ADD COLUMN startedById TEXT DEFAULT NULL;

      ALTER TABLE callsHistory
        ADD COLUMN endedTimestamp INTEGER DEFAULT NULL;
    `);

    db.pragma('user_version = 1210');
  })();
  logger.info('updateToSchemaVersion1210: success!');
}
