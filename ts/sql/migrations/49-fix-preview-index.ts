// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion49(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 49) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX messages_preview;

      -- Note the omitted 'expiresAt' column in the index. If it is present
      -- sqlite can't ORDER BY received_at, sent_at using this index.
      CREATE INDEX messages_preview ON messages
        (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, received_at, sent_at);
      `
    );

    db.pragma('user_version = 49');
  })();

  logger.info('updateToSchemaVersion49: success!');
}
