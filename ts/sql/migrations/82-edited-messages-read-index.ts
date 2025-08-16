// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion82(db: Database): void {
  db.exec(`
    ALTER TABLE edited_messages DROP COLUMN fromId;
    ALTER TABLE edited_messages ADD COLUMN conversationId STRING;

    CREATE INDEX edited_messages_unread ON edited_messages (readStatus, conversationId);
  `);
}
