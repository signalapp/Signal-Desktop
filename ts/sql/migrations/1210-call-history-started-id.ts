// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1210(db: Database): void {
  // The standard getNextAttachmentDownloadJobs query uses active & source conditions,
  // ordered by received_at
  db.exec(`
    ALTER TABLE callsHistory
      ADD COLUMN startedById TEXT DEFAULT NULL;

    ALTER TABLE callsHistory
      ADD COLUMN endedTimestamp INTEGER DEFAULT NULL;
  `);
}
