// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1610(db: WritableDB): void {
  db.exec(`
    ALTER TABLE messages
      ADD COLUMN hasContacts INTEGER NOT NULL
      GENERATED ALWAYS AS (
        IFNULL(json_array_length(json, '$.contact'), 0) > 0
      );

    CREATE INDEX messages_hasContacts
      ON messages (conversationId, received_at DESC, sent_at DESC)
      WHERE
        hasContacts IS 1 AND
        isViewOnce IS NOT 1 AND
        type IN ('incoming', 'outgoing');
  `);
}
