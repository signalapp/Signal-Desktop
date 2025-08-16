// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1070(db: Database): void {
  db.exec(`
    CREATE TABLE attachment_backup_jobs (
      mediaName TEXT NOT NULL PRIMARY KEY,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      receivedAt INTEGER NOT NULL,

      -- job manager fields
      attempts INTEGER NOT NULL,
      active INTEGER NOT NULL,
      retryAfter INTEGER,
      lastAttemptTimestamp INTEGER
    ) STRICT;

    CREATE INDEX attachment_backup_jobs_receivedAt
      ON attachment_backup_jobs (
        receivedAt
    );

    CREATE INDEX attachment_backup_jobs_type_receivedAt
      ON attachment_backup_jobs (
        type, receivedAt
    );

    CREATE TABLE backup_cdn_object_metadata (
      mediaId TEXT NOT NULL PRIMARY KEY,
      cdnNumber INTEGER NOT NULL,
      sizeOnBackupCdn INTEGER
    ) STRICT;
  `);
}
