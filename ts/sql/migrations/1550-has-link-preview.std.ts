// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1550(db: WritableDB): void {
  db.exec(`
    ALTER TABLE messages
      ADD COLUMN hasPreviews INTEGER NOT NULL
      GENERATED ALWAYS AS (
        IFNULL(json_array_length(json, '$.preview'), 0) > 0
      );

    CREATE INDEX messages_hasPreviews
      ON messages (conversationId, received_at DESC, sent_at DESC)
      WHERE
        hasPreviews IS 1 AND
        isViewOnce IS NOT 1 AND
        type IN ('incoming', 'outgoing');
  `);
}
