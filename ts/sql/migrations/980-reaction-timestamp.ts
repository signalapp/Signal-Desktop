// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 980;

export function updateToSchemaVersion980(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 980) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE reactions ADD COLUMN timestamp NUMBER;

      CREATE INDEX reactions_byTimestamp
      ON reactions
      (fromId, timestamp);
    `);

    db.pragma('user_version = 980');
  })();

  logger.info('updateToSchemaVersion980: success!');
}
