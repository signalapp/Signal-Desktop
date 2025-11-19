// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1560(db: WritableDB): void {
  const [query] = sql`
    CREATE TABLE pinnedMessages (
     	id               INTEGER PRIMARY KEY AUTOINCREMENT,
     	conversationId   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     	messageId        TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
     	messageSentAt    INTEGER NOT NULL,
     	messageSenderAci TEXT NOT NULL,
     	pinnedByAci      TEXT NOT NULL,
     	pinnedAt         INTEGER NOT NULL,
     	expiresAt        INTEGER,
     	UNIQUE (conversationId, messageId)
    ) STRICT;

    CREATE INDEX pinnedMessages_byConversation
      ON pinnedMessages(
        conversationId,
        pinnedAt DESC,
        messageId
      );

    CREATE INDEX pinnedMessages_byExpiresAt
      ON pinnedMessages(
        expiresAt ASC
      )
      WHERE expiresAt IS NOT NULL;
  `;
  db.exec(query);
}
