// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion70(db: Database): void {
  // Used in `getAllStories`.
  db.exec(
    `
    CREATE INDEX messages_by_storyId ON messages (storyId);
    `
  );
}
