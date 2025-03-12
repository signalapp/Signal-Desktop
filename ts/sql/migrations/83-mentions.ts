// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';
import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion83(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 83) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE messages
        ADD COLUMN mentionsMe INTEGER NOT NULL DEFAULT 0;
      
      -- one which includes story data...
      CREATE INDEX messages_unread_mentions ON messages
        (conversationId, readStatus, mentionsMe, isStory, storyId, received_at, sent_at)
        WHERE readStatus IS NOT NULL;
      
      -- ...and one which doesn't, so storyPredicate works as expected
      CREATE INDEX messages_unread_mentions_no_story_id ON messages
        (conversationId, readStatus, mentionsMe, isStory, received_at, sent_at)
        WHERE isStory IS 0 AND readStatus IS NOT NULL;
      `
    );

    db.pragma('user_version = 83');
  })();

  logger.info('updateToSchemaVersion83: success!');
}
