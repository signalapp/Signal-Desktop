// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

// This migration was backported to earlier branches as 1541 and 1551
export default function updateToSchemaVersion1561(
  db: WritableDB,
  logger: LoggerType
): void {
  const [query, params] = sql`
    UPDATE messages 
      SET 
        json = json_remove(json, '$.poll'),
        hasUnreadPollVotes = 0
      WHERE isErased = 1 AND (
        json->'poll' IS NOT NULL OR
        hasUnreadPollVotes IS NOT 0
      )
  `;
  const result = db.prepare(query).run(params);
  logger.info(`Updated ${result.changes} poll messages`);
}
