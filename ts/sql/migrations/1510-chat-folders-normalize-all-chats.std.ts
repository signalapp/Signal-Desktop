// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1510(
  db: WritableDB,
  logger: LoggerType
): void {
  const FOLDER_TYPE_ALL = 1;
  const [query, params] = sql`
    UPDATE chatFolders
    SET
      includeAllIndividualChats = 1,
      includeAllGroupChats = 1,
      storageNeedsSync = 1
    WHERE
      folderType = ${FOLDER_TYPE_ALL}
      AND (
        includeAllIndividualChats IS 0
        OR
        includeAllGroupChats IS 0
      )
  `;
  const result = db.prepare(query).run(params);
  logger.info(`Updated ${result.changes} all chats chat folders`);
}
