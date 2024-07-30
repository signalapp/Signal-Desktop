// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1010;

export function updateToSchemaVersion1010(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1010) {
    return;
  }

  db.transaction(() => {
    const [createTable] = sql`
      CREATE TABLE callLinks (
        roomId TEXT NOT NULL PRIMARY KEY,
        rootKey BLOB NOT NULL,
        adminKey BLOB,
        name TEXT NOT NULL,
        -- Enum which stores CallLinkRestrictions from ringrtc
        restrictions INTEGER NOT NULL,
        revoked INTEGER NOT NULL,
        expiration INTEGER
      ) STRICT;
    `;

    db.exec(createTable);

    db.pragma('user_version = 1010');
  })();

  logger.info('updateToSchemaVersion1010: success!');
}
