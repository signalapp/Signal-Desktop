// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1120(db: Database): void {
  /** Adds indexes for all tables with foreign key relationships to messages(id) */
  db.exec(`
    CREATE INDEX edited_messages_messageId
      ON edited_messages(messageId);

    CREATE INDEX mentions_messageId
      ON mentions(messageId);
  `);
}
