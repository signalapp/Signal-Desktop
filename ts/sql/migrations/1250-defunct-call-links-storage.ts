// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export const version = 1250;

export function updateToSchemaVersion1250(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1250) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE defunctCallLinks ADD COLUMN storageID TEXT;
      ALTER TABLE defunctCallLinks ADD COLUMN storageVersion INTEGER;
      ALTER TABLE defunctCallLinks ADD COLUMN storageUnknownFields BLOB;
      ALTER TABLE defunctCallLinks ADD COLUMN storageNeedsSync INTEGER NOT NULL DEFAULT 0;
    `);

    db.pragma('user_version = 1250');
  })();
  logger.info('updateToSchemaVersion1250: success!');
}
