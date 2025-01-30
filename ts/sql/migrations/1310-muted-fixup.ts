// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import type { WritableDB } from '../Interface';

export const version = 1310;

// Value from ts/util/timestamp.ts at the time of creation of this migration
const MAX_SAFE_DATE = 8640000000000000;

export function updateToSchemaVersion1310(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1310) {
    return;
  }

  db.transaction(() => {
    const [query, params] = sql`
      UPDATE conversations
        SET json = json_replace(
          json,
          '$.muteExpiresAt',
          9007199254740991 -- max safe integer
        )
        WHERE json ->> '$.muteExpiresAt' IS ${MAX_SAFE_DATE};
    `;
    const { changes } = db.prepare(query).run(params);
    if (changes !== 0) {
      logger.warn(`updateToSchemaVersion1310: fixed ${changes} conversations`);
    }

    db.pragma('user_version = 1310');
  })();

  logger.info('updateToSchemaVersion1310: success!');
}
