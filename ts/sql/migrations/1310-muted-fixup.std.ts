// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { LoggerType } from '../../types/Logging.std.js';
import { sql } from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';

// Value from ts/util/timestamp.ts at the time of creation of this migration
const MAX_SAFE_DATE = 8640000000000000;

export default function updateToSchemaVersion1310(
  db: WritableDB,
  logger: LoggerType
): void {
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
    logger.warn(`fixed ${changes} conversations`);
  }
}
