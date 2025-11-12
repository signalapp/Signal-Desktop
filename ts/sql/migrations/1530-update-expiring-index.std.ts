// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1520(db: Database): void {
  db.exec(
    'DROP INDEX IF EXISTS expiring_message_by_conversation_and_received_at;'
  );

  db.exec(`
    ALTER TABLE messages ADD COLUMN hasExpireTimer INTEGER NOT NULL
    GENERATED ALWAYS AS (COALESCE(expireTimer, 0) > 0) VIRTUAL;     
  `);

  db.exec(`
    CREATE INDEX messages_conversationId_hasExpireTimer_expirationStartTimestamp
    ON messages (conversationId, hasExpireTimer, expirationStartTimestamp);
  `);
}
