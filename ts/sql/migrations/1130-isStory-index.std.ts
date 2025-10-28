// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1130(db: Database): void {
  // This is to improve the performance of getAllStories
  db.exec(`
    CREATE INDEX messages_isStory
      ON messages(received_at, sent_at)
      WHERE isStory = 1;
  `);
}
