// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion67(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 71) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      CREATE TABLE gifs(
        id STRING PRIMARY KEY ASC,
        giphy_id STRING UNIQUE,
        last_used INTEGER
      );
      `
    );

    db.pragma('user_version = 71');
  })();

  logger.info('updateToSchemaVersion71: success!');
}
