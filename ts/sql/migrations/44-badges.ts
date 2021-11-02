// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion44(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 44) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      CREATE TABLE badges(
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        descriptionTemplate TEXT NOT NULL
      );

      CREATE TABLE badgeImageFiles(
        badgeId TEXT REFERENCES badges(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        'order' INTEGER NOT NULL,
        url TEXT NOT NULL,
        localPath TEXT,
        theme TEXT NOT NULL
      );
      `
    );

    db.pragma('user_version = 44');
  })();

  logger.info('updateToSchemaVersion44: success!');
}
