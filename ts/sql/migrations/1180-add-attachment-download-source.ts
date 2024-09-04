// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import { AttachmentDownloadSource } from '../Interface';

export const version = 1180;
export function updateToSchemaVersion1180(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1180) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 1180');
  })();
  logger.info('updateToSchemaVersion1180: success!');
}
