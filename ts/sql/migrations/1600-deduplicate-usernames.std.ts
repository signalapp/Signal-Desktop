// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { LoggerType } from '../../types/Logging.std.js';
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1600(
  db: WritableDB,
  logger: LoggerType
): void {
  const jsonPatch = JSON.stringify({
    username: null,
    needsStorageServiceSync: true,
  });
  const [query, params] = sql`
    WITH rowsKeepingUsername AS (
      SELECT
        rowId,
        json ->> '$.username' AS username,
        MAX(active_at)
      FROM conversations
      WHERE username IS NOT NULL
      GROUP BY username
    )
    UPDATE conversations AS c
    SET json = json_patch(json, ${jsonPatch})
    WHERE json ->> '$.username' IS NOT NULL
      AND c.rowId NOT IN (
        SELECT rowId from rowsKeepingUsername
      );
  `;
  const result = db.prepare(query).run(params);
  if (result.changes > 0) {
    logger.warn(
      `Removed duplicate usernames from ${result.changes} conversations`
    );
  }
}
