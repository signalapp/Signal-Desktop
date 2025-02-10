// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import type { WritableDB } from '../Interface';

export const version = 1320;

export function updateToSchemaVersion1320(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1320) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      DROP INDEX unprocessed_timestamp;

      ALTER TABLE unprocessed
        ADD COLUMN receivedAtDate INTEGER DEFAULT 0 NOT NULL;

      UPDATE unprocessed
        SET receivedAtDate = timestamp;

      CREATE INDEX unprocessed_byReceivedAtDate ON unprocessed
        (receivedAtDate);
    `;
    db.exec(query);

    db.pragma('user_version = 1320');
  })();

  logger.info('updateToSchemaVersion1320: success!');
}
