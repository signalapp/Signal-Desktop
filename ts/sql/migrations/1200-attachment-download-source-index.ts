// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1200(db: Database): void {
  // The standard getNextAttachmentDownloadJobs query uses active & source conditions,
  // ordered by received_at
  db.exec(`
    CREATE INDEX attachment_downloads_active_source_receivedAt
        ON attachment_downloads (
            active, source, receivedAt
        );
  `);
}
