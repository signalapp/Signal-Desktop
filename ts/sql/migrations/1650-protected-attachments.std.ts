// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1650(db: WritableDB): void {
  db.exec(`
      CREATE TABLE attachments_protected_from_deletion (
        path TEXT NOT NULL,
        UNIQUE (path)
      ) STRICT;
    `);

  db.exec(`
    CREATE INDEX message_attachments_plaintextHash ON message_attachments (plaintextHash);
  `);
  db.exec(`
    CREATE INDEX message_attachments_path ON message_attachments (path);
  `);
  db.exec(`
    CREATE INDEX message_attachments_thumbnailPath ON message_attachments (thumbnailPath);
  `);
  db.exec(`
    CREATE INDEX message_attachments_screenshotPath ON message_attachments (screenshotPath);
  `);
  db.exec(`
    CREATE INDEX message_attachments_backupThumbnailPath ON message_attachments (backupThumbnailPath);
  `);

  db.exec(`
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
      WHERE path IN (NEW.path, NEW.thumbnailPath, NEW.screenshotPath, NEW.backupThumbnailPath);
    END;
  `);

  db.exec(`
    CREATE TRIGGER stop_protecting_attachments_after_insert 
    AFTER INSERT 
    ON message_attachments
    BEGIN
      DELETE FROM attachments_protected_from_deletion 
      WHERE path IN (NEW.path, NEW.thumbnailPath, NEW.screenshotPath, NEW.backupThumbnailPath);
    END;
  `);
}
