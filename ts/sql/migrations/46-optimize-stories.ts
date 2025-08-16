// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion46(db: Database): void {
  db.exec(
    `
    --- Add column to messages table

    ALTER TABLE messages
    ADD COLUMN
    isStory INTEGER
    GENERATED ALWAYS
    AS (type = 'story');

    --- Update important message indices

    DROP INDEX   messages_conversation;
    CREATE INDEX messages_conversation ON messages
      (conversationId, isStory, storyId, received_at, sent_at);
    `
  );
}
