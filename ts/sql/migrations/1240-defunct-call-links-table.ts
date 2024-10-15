// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1240;

export function updateToSchemaVersion1240(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1240) {
    return;
  }

  db.transaction(() => {
    const [createTable] = sql`
      CREATE TABLE defunctCallLinks (
        roomId TEXT NOT NULL PRIMARY KEY,
        rootKey BLOB NOT NULL,
        adminKey BLOB
      ) STRICT;
    `;

    db.exec(createTable);

    db.pragma('user_version = 1240');
  })();

  logger.info('updateToSchemaVersion1240: success!');
}
