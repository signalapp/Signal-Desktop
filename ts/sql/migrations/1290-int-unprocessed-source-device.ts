// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import type { WritableDB } from '../Interface';

export const version = 1290;

export function updateToSchemaVersion1290(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1290) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      ALTER TABLE unprocessed RENAME COLUMN sourceDevice TO legacySourceDevice;
      ALTER TABLE unprocessed ADD COLUMN sourceDevice INTEGER;

      UPDATE unprocessed
      SET sourceDevice = legacySourceDevice;

      ALTER TABLE unprocessed DROP COLUMN legacySourceDevice;
    `;
    db.exec(query);

    db.pragma('user_version = 1290');
  })();

  logger.info('updateToSchemaVersion1290: success!');
}
