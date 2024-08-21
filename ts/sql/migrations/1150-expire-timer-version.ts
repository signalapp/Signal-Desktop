// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export const version = 1150;

export function updateToSchemaVersion1150(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1150) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      -- All future conversations will start from '1'
      ALTER TABLE conversations
        ADD COLUMN expireTimerVersion INTEGER NOT NULL DEFAULT 1;

      -- All current conversations will start from '2'
      UPDATE conversations SET expireTimerVersion = 2;
    `);

    db.pragma('user_version = 1150');
  })();
  logger.info('updateToSchemaVersion1150: success!');
}
