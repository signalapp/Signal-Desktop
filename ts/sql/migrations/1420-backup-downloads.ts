// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { AttachmentDownloadSource, type WritableDB } from '../Interface';

export const version = 1420;

export function updateToSchemaVersion1420(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1420) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE attachment_downloads
        ADD COLUMN originalSource TEXT NOT NULL DEFAULT ${AttachmentDownloadSource.STANDARD};
      
      UPDATE attachment_downloads
        SET originalSource = source;
    `);

    db.exec(`
      CREATE TABLE attachment_downloads_backup_stats (
        id INTEGER PRIMARY KEY CHECK (id = 0),
        totalBytes INTEGER NOT NULL,
        completedBytes INTEGER NOT NULL
      ) STRICT;

      INSERT INTO attachment_downloads_backup_stats
        (id, totalBytes, completedBytes)
        VALUES
        (0, 0, 0);

      CREATE TRIGGER attachment_downloads_backup_job_insert 
        AFTER INSERT ON attachment_downloads
        WHEN NEW.originalSource = 'backup_import'
        BEGIN
          UPDATE attachment_downloads_backup_stats SET
            totalBytes = totalBytes + NEW.ciphertextSize; 
        END;
      
      CREATE TRIGGER attachment_downloads_backup_job_update
        AFTER UPDATE OF ciphertextSize ON attachment_downloads 
        WHEN NEW.originalSource = 'backup_import'
        BEGIN
          UPDATE attachment_downloads_backup_stats SET
            totalBytes = MAX(0, totalBytes - OLD.ciphertextSize + NEW.ciphertextSize)
          WHERE id = 0;
        END;

      CREATE TRIGGER attachment_downloads_backup_job_delete
        AFTER DELETE ON attachment_downloads 
        WHEN OLD.originalSource = 'backup_import' 
        BEGIN
          UPDATE attachment_downloads_backup_stats SET
            completedBytes = completedBytes + OLD.ciphertextSize
          WHERE id = 0;
        END;
    `);

    db.pragma('user_version = 1420');
  })();

  logger.info('updateToSchemaVersion1420: success!');
}
