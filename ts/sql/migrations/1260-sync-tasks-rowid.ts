// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1260;

export function updateToSchemaVersion1260(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1260) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      DROP INDEX IF EXISTS syncTasks_order;
      CREATE INDEX syncTasks_delete ON syncTasks (attempts DESC);
    `;

    db.exec(query);

    db.pragma('user_version = 1260');
  })();

  logger.info('updateToSchemaVersion1260: success!');
}
