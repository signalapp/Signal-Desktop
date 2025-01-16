// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1270;

export function updateToSchemaVersion1270(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1270) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      ALTER TABLE messages
        ADD COLUMN timestamp INTEGER;
      ALTER TABLE messages
        ADD COLUMN received_at_ms INTEGER;
      ALTER TABLE messages
        ADD COLUMN unidentifiedDeliveryReceived INTEGER;
      ALTER TABLE messages
        ADD COLUMN serverTimestamp INTEGER;

      ALTER TABLE messages
        RENAME COLUMN source TO legacySource;
      ALTER TABLE messages
        ADD COLUMN source TEXT;

      UPDATE messages SET
        timestamp = json_extract(json, '$.timestamp'),
        received_at_ms = json_extract(json, '$.received_at_ms'),
        unidentifiedDeliveryReceived =
          json_extract(json, '$.unidentifiedDeliveryReceived'),
        serverTimestamp =
          json_extract(json, '$.serverTimestamp'),
        source = IFNULL(json_extract(json, '$.source'), '+' || legacySource);

      ALTER TABLE messages
        DROP COLUMN legacySource;
    `;

    db.exec(query);

    db.pragma('user_version = 1270');
  })();

  logger.info('updateToSchemaVersion1270: success!');
}
