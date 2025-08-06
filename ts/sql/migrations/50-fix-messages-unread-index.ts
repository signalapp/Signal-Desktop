// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion50(db: Database): void {
  db.exec(
    `
    DROP INDEX messages_unread;

    -- Note: here we move to the modern isStory/storyId fields and add received_at/sent_at.
    CREATE INDEX messages_unread ON messages
      (conversationId, readStatus, isStory, storyId, received_at, sent_at) WHERE readStatus IS NOT NULL;
    `
  );
}
