// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export const version = 970;

export function updateToSchemaVersion970(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 970) {
    return;
  }

  const start = Date.now();
  db.transaction(() => {
    db.exec(`
      INSERT INTO messages_fts(messages_fts) VALUES ('optimize');
    `);
    db.pragma('user_version = 970');
  })();

  const duration = Date.now() - start;
  logger.info(
    `updateToSchemaVersion970: success! fts optimize took ${duration}ms`
  );
}
