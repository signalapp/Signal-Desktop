// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1360(db: WritableDB): void {
  db.exec(`
    DROP TABLE IF EXISTS message_attachments;
  `);

  db.exec(`
    CREATE TABLE message_attachments (
      messageId TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      -- For editHistoryIndex to be part of the primary key, it cannot be NULL in strict tables.
      -- For that reason, we use a value of -1 to indicate that it is the root message (not in editHistory)
      editHistoryIndex INTEGER NOT NULL,
      attachmentType TEXT NOT NULL, -- 'long-message' | 'quote' | 'attachment' | 'preview' | 'contact' | 'sticker'
      orderInMessage INTEGER NOT NULL,
      conversationId TEXT NOT NULL,
      sentAt INTEGER NOT NULL,
      clientUuid TEXT,
      size INTEGER NOT NULL,
      contentType TEXT NOT NULL,
      path TEXT,
      plaintextHash TEXT,
      localKey TEXT,
      caption TEXT,
      fileName TEXT,
      blurHash TEXT,
      height INTEGER,
      width INTEGER,
      digest TEXT,
      key TEXT,
      iv TEXT,
      downloadPath TEXT,
      version INTEGER,
      incrementalMac TEXT,
      incrementalMacChunkSize INTEGER,
      transitCdnKey TEXT,
      transitCdnNumber INTEGER,
      transitCdnUploadTimestamp INTEGER,
      backupMediaName TEXT,
      backupCdnNumber INTEGER,
      isReencryptableToSameDigest INTEGER,
      reencryptionIv TEXT,
      reencryptionKey TEXT,
      reencryptionDigest TEXT,
      thumbnailPath TEXT,
      thumbnailSize INTEGER,
      thumbnailContentType TEXT,
      thumbnailLocalKey TEXT,
      thumbnailVersion INTEGER,
      screenshotPath TEXT,
      screenshotSize INTEGER,
      screenshotContentType TEXT,
      screenshotLocalKey TEXT,
      screenshotVersion INTEGER,
      backupThumbnailPath TEXT,
      backupThumbnailSize INTEGER,
      backupThumbnailContentType TEXT,
      backupThumbnailLocalKey TEXT,
      backupThumbnailVersion INTEGER,
      storyTextAttachmentJson TEXT,
      localBackupPath TEXT,
      flags INTEGER,
      error INTEGER,
      wasTooBig INTEGER,
      isCorrupted INTEGER,
      copiedFromQuotedAttachment INTEGER,
      pending INTEGER,
      backfillError INTEGER,
      PRIMARY KEY (messageId, editHistoryIndex, attachmentType, orderInMessage)
    ) STRICT;
  `);

  // The following indexes were removed in migration 1370

  // db.exec(
  //   'CREATE INDEX message_attachments_messageId
  //    ON message_attachments (messageId);'
  // );
  // db.exec(
  //   'CREATE INDEX message_attachments_plaintextHash
  //    ON message_attachments (plaintextHash);'
  // );
  // db.exec(
  //   'CREATE INDEX message_attachments_path
  //    ON message_attachments (path);'
  // );
  // db.exec(
  //   'CREATE INDEX message_attachments_all_thumbnailPath
  //    ON message_attachments (thumbnailPath);'
  // );
  // db.exec(
  //   'CREATE INDEX message_attachments_all_screenshotPath
  //    ON message_attachments (screenshotPath);'
  // );
  // db.exec(
  //   'CREATE INDEX message_attachments_all_backupThumbnailPath
  //    ON message_attachments (backupThumbnailPath);'
  // );
}
