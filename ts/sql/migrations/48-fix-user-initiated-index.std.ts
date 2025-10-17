// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion48(db: Database): void {
  db.exec(
    `
    DROP INDEX   message_user_initiated;

    CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);
    `
  );
}
