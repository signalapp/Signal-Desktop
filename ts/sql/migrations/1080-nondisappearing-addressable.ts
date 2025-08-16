// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1080(db: Database): void {
  db.exec(`
    CREATE INDEX messages_by_date_addressable_nondisappearing
      ON messages (
        conversationId, isAddressableMessage, received_at, sent_at
    ) WHERE expireTimer IS NULL;
  `);
}
