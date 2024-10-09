// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export const version = 1230;

export function updateToSchemaVersion1230(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1230) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      DROP INDEX IF EXISTS callLinks_adminKey;

      CREATE INDEX callLinks_adminKey
        ON callLinks (adminKey);
    `);

    db.pragma('user_version = 1230');
  })();
  logger.info('updateToSchemaVersion1230: success!');
}
