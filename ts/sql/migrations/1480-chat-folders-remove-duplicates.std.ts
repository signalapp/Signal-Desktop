// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1480(
  db: WritableDB,
  logger: LoggerType
): void {
  const [query, params] = sql`
    DELETE FROM chatFolders
    WHERE folderType IS 1
    AND id NOT IN (
      SELECT id FROM chatFolders
      WHERE folderType IS 1
      ORDER BY storageVersion DESC
      LIMIT 1
    )
  `;
  const result = db.prepare(query).run(params);
  logger.info(`Removed ${result.changes} duplicate all chats chat folders`);
}
