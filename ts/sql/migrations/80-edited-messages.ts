// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion80(db: Database): void {
  db.exec(`
    CREATE TABLE edited_messages(
      fromId STRING,
      messageId STRING REFERENCES messages(id)
        ON DELETE CASCADE,
      sentAt INTEGER,
      readStatus INTEGER
    );

    CREATE INDEX edited_messages_sent_at ON edited_messages (sentAt);
  `);
}
