// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

// TODO: DESKTOP-3694
export default function updateToSchemaVersion60(db: Database): void {
  db.exec(
    `
    DROP INDEX expiring_message_by_conversation_and_received_at;

    CREATE INDEX expiring_message_by_conversation_and_received_at
      ON messages
      (
        conversationId,
        storyId,
        expirationStartTimestamp,
        expireTimer,
        received_at
      )
      WHERE isStory IS 0 AND type IS 'incoming';
    `
  );
}
