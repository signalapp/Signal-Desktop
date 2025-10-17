// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion76(db: Database): void {
  db.exec(
    `
    -- Re-created below
    DROP INDEX IF EXISTS message_expires_at;
    DROP INDEX IF EXISTS messages_preview;

    -- Create non-null expiresAt column
    ALTER TABLE messages
      DROP COLUMN expiresAt;

    ALTER TABLE messages
      ADD COLUMN
      expiresAt INT
      GENERATED ALWAYS
      AS (ifnull(
        expirationStartTimestamp + (expireTimer * 1000),
        ${Number.MAX_SAFE_INTEGER}
      ));

    -- Re-create indexes
    -- Note the "s" at the end of "messages"
    CREATE INDEX messages_expires_at ON messages (
      expiresAt
    );

    -- Note that expiresAt is intentionally dropped from the index since
    -- expiresAt > $now is likely to be true so we just try selecting it
    -- *after* ordering by received_at/sent_at.
    CREATE INDEX messages_preview ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at);
    CREATE INDEX messages_preview_without_story ON messages
      (conversationId, shouldAffectPreview, isGroupLeaveEventFromOther,
       received_at, sent_at) WHERE storyId IS NULL;
    `
  );
}
