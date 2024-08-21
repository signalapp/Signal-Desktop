// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export default function updateToSchemaVersion90(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 90) {
    return;
  }

  let numChanges = 0;
  db.transaction(() => {
    const [updateQuery, updateParams] = sql`
        UPDATE messages
        SET json = json_remove(json, '$.storyReplyContext.attachment.screenshotData')
        WHERE isStory = 0

        /* we want to find all messages with a non-null storyId, but using string 
        comparison (instead of a non-null check) here causes Sqlite to use the 
        storyId index */
        AND storyId > '0' 

        AND json->'$.storyReplyContext.attachment.screenshotData' IS NOT NULL;
    `;

    const info = db.prepare(updateQuery).run(updateParams);
    numChanges = info.changes;

    db.pragma('user_version = 90');
  })();

  logger.info(
    `updateToSchemaVersion90: removed screenshotData from ${numChanges} ` +
      `message${numChanges > 1 ? 's' : ''}`
  );

  logger.info('updateToSchemaVersion90: success!');
}
