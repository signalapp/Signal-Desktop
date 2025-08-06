// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1090(db: Database): void {
  db.exec(`
    CREATE INDEX reactions_messageId
      ON reactions (messageId);

    CREATE INDEX storyReads_storyId
      ON storyReads (storyId);
  `);
}
