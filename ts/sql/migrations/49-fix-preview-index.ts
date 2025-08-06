// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion49(db: Database): void {
  db.exec(
    `
    DROP INDEX messages_preview;

    -- Note the omitted 'expiresAt' column in the index. If it is present
    -- sqlite can't ORDER BY received_at, sent_at using this index.
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther, received_at, sent_at);
    `
  );
}
