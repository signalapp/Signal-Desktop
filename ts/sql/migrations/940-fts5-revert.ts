// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 940;

export function updateToSchemaVersion940(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 940) {
    return;
  }

  db.transaction(() => {
    const wasEnabled =
      db
        .prepare(
          `
            SELECT v FROM messages_fts_config WHERE k is 'secure-delete';
          `
        )
        .pluck()
        .get() === 1;

    if (wasEnabled) {
      logger.info('updateToSchemaVersion940: rebuilding fts5 index');
      db.exec(`
        --- Disable 'secure-delete'
        INSERT INTO messages_fts
        (messages_fts, rank)
        VALUES
        ('secure-delete', 0);

        --- Rebuild the index to fix the corruption
        INSERT INTO messages_fts
        (messages_fts)
        VALUES
        ('rebuild');
      `);
    } else {
      logger.info(
        'updateToSchemaVersion940: secure delete was not enabled, skipping'
      );
    }

    db.pragma('user_version = 940');
  })();

  logger.info('updateToSchemaVersion940: success!');
}
