// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion74(db: Database): void {
  db.exec(
    `
    -- Previously: (isUserInitiatedMessage)
    DROP INDEX message_user_initiated;

    CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);

    -- Previously: (unread, conversationId)
    DROP INDEX reactions_unread;

    CREATE INDEX reactions_unread ON reactions (
      conversationId,
      unread
    );
    `
  );
}
