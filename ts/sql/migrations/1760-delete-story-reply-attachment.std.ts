// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging.std.ts';
import { sql } from '../util.std.ts';

export default function updateToSchemaVersion1760(
  db: Database,
  logger: LoggerType
): void {
  const [updateQuery, updateParams] = sql`
      UPDATE messages
      SET json = json_remove(json, '$.storyReplyContext.attachment')
      WHERE isStory = 0

      /* we want to find all messages with a non-null storyId, but using string 
      comparison (instead of a non-null check) here causes Sqlite to use the 
      storyId index */
      AND storyId > '0'
      
      AND json->'$.storyReplyContext.attachment' IS NOT NULL;
  `;

  const info = db.prepare(updateQuery).run(updateParams);

  logger.info(
    `updateToSchemaVersion1760: removed storyReplyContext.attachment from ` +
      `${info.changes} message(s)`
  );
}
