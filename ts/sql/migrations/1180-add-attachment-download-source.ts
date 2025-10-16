// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';
import { AttachmentDownloadSource } from '../Interface.std.js';

export default function updateToSchemaVersion1180(db: Database): void {
  db.exec(`
    ALTER TABLE attachment_downloads
        ADD COLUMN source TEXT NOT NULL DEFAULT ${AttachmentDownloadSource.STANDARD};

    ALTER TABLE attachment_downloads
        -- this default value will be overridden by getNextAttachmentDownloadJobs
        ADD COLUMN ciphertextSize INTEGER NOT NULL DEFAULT 0;
  `);

  db.exec(`
    CREATE INDEX attachment_downloads_source_ciphertextSize
        ON attachment_downloads (
            source, ciphertextSize
        );
  `);
}
