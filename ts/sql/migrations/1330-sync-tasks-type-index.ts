// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1330;

export function updateToSchemaVersion1330(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1330) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      CREATE INDEX syncTasks_type ON syncTasks (type);
    `;

    db.exec(query);

    db.pragma('user_version = 1330');
  })();

  logger.info('updateToSchemaVersion1330: success!');
}
