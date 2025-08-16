// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion52(db: Database): void {
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
}
