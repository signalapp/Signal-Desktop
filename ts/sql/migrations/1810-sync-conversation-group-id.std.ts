// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sql } from '../util.std.ts';

import type { WritableDB } from '../Interface.std.ts';
import type { LoggerType } from '../../types/Logging.std.ts';

export default function updateToSchemaVersion1810(
  db: WritableDB,
  logger: LoggerType
): void {
  // `updateConversation` didn't write the `groupId` column, so these could have strayed
  // (e.g. during GV2 migration)
  const [query] = sql`
    UPDATE conversations
    SET groupId = json ->> '$.groupId'
    WHERE type IS 'group'
      AND json ->> '$.groupId' IS NOT NULL
      AND groupId IS NOT json ->> '$.groupId';
  `;
  const result = db.prepare(query).run();
  logger.info(`Updated groupId for ${result.changes} conversations`);
}
