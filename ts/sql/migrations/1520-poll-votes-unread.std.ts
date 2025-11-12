// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1510(db: Database): void {
  db.exec(`
    -- Add hasUnreadPollVotes column to messages table
    ALTER TABLE messages ADD COLUMN hasUnreadPollVotes INTEGER NOT NULL DEFAULT 0;

    -- Create partial index for efficient queries
    -- Only indexes rows where hasUnreadPollVotes = 1
    CREATE INDEX messages_unread_poll_votes ON messages (
      conversationId,
      received_at
    ) WHERE hasUnreadPollVotes = 1 AND type IS 'outgoing';
  `);
}
