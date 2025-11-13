// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1530(db: Database): void {
  db.exec(`
    ALTER TABLE messages ADD COLUMN hasExpireTimer INTEGER NOT NULL
    GENERATED ALWAYS AS (COALESCE(expireTimer, 0) > 0) VIRTUAL;     
  `);

  // Deprecated by migration 1540
  // db.exec(`
  //   CREATE INDEX messages_conversationId_hasExpireTimer_expirationStartTimestamp
  //   ON messages (conversationId, hasExpireTimer, expirationStartTimestamp);
  // `);
}
