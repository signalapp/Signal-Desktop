// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1660(db: WritableDB): void {
  db.exec(`
    DROP TABLE attachments_protected_from_deletion;
    
    CREATE TABLE attachments_protected_from_deletion (
      path TEXT NOT NULL,
      messageId TEXT NOT NULL,
      PRIMARY KEY (path, messageId)
    ) STRICT;
  `);

  db.exec(`
    DROP TRIGGER stop_protecting_attachments_after_update;
    
    CREATE TRIGGER stop_protecting_attachments_after_update 
    AFTER UPDATE OF path, thumbnailPath, screenshotPath, backupThumbnailPath 
    ON message_attachments
    WHEN 
      OLD.path IS NOT NEW.path OR
      OLD.thumbnailPath IS NOT NEW.thumbnailPath OR
      OLD.screenshotPath IS NOT NEW.screenshotPath OR
      OLD.backupThumbnailPath IS NOT NEW.backupThumbnailPath
    BEGIN
      DELETE FROM attachments_protected_from_deletion 
      WHERE 
        messageId IS NEW.messageId 
        AND path IN (
          NEW.path, 
          NEW.thumbnailPath, 
          NEW.screenshotPath, 
          NEW.backupThumbnailPath
        );
    END;
  `);

  db.exec(`
    DROP TRIGGER stop_protecting_attachments_after_insert;

    CREATE TRIGGER stop_protecting_attachments_after_insert 
    AFTER INSERT 
    ON message_attachments
    BEGIN
      DELETE FROM attachments_protected_from_deletion 
      WHERE 
        messageId IS NEW.messageId 
        AND path IN (
          NEW.path, 
          NEW.thumbnailPath, 
          NEW.screenshotPath, 
          NEW.backupThumbnailPath
        );
    END;
  `);
}
