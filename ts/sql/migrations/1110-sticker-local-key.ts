// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 1110;

export function updateToSchemaVersion1110(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1110) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE stickers
        ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE stickers
        ADD COLUMN localKey TEXT;

      ALTER TABLE stickers
        ADD COLUMN size INTEGER;
    `);

    db.pragma('user_version = 1110');
  })();

  logger.info('updateToSchemaVersion1110: success!');
}
