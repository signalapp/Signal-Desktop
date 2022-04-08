// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion52(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 52) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      -- Create indices that don't have storyId in them so that
      -- '_storyIdPredicate' could be optimized.

      -- See migration 47
      CREATE INDEX messages_conversation_no_story_id ON messages
        (conversationId, isStory, received_at, sent_at);

      -- See migration 50
      CREATE INDEX messages_unread_no_story_id ON messages
        (conversationId, readStatus, isStory, received_at, sent_at)
        WHERE readStatus IS NOT NULL;
      `
    );

    db.pragma('user_version = 52');
  })();

  logger.info('updateToSchemaVersion52: success!');
}
