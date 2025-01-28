// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import type { WritableDB } from '../Interface';

export const version = 1300;

export function updateToSchemaVersion1300(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1300) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      ALTER TABLE sticker_references
        ADD COLUMN stickerId INTEGER NOT NULL DEFAULT -1;
      ALTER TABLE sticker_references
        ADD COLUMN isUnresolved INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX unresolved_sticker_refs
      ON sticker_references (packId, stickerId)
      WHERE isUnresolved IS 1;
    `;
    db.exec(query);

    db.pragma('user_version = 1300');
  })();

  logger.info('updateToSchemaVersion1300: success!');
}
