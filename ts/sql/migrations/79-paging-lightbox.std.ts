// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion79(db: Database): void {
  db.exec(`
    DROP INDEX   messages_hasVisualMediaAttachments;
    CREATE INDEX messages_hasVisualMediaAttachments
      ON messages (
        conversationId, isStory, storyId,
        hasVisualMediaAttachments, received_at, sent_at
      )
      WHERE hasVisualMediaAttachments IS 1;
  `);
}
