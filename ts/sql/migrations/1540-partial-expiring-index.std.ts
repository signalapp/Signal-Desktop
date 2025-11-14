// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1540(db: Database): void {
  db.exec(
    'DROP INDEX IF EXISTS messages_conversationId_hasExpireTimer_expirationStartTimestamp;'
  );

  db.exec(`
    CREATE INDEX messages_conversationId_expirationStartTimestamp
    ON messages (conversationId, expirationStartTimestamp)
    WHERE hasExpireTimer IS 1;
  `);
}
