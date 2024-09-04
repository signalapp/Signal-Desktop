// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1170;
export function updateToSchemaVersion1170(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1170) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      DROP INDEX IF EXISTS messages_callHistory_markReadBefore;
      CREATE INDEX messages_callHistory_markReadBefore
        ON messages (type, seenStatus, received_at DESC)
        WHERE type IS 'call-history';
    `;
    db.exec(query);

    db.pragma('user_version = 1170');
  })();
  logger.info('updateToSchemaVersion1170: success!');
}
