// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1370(db: WritableDB): void {
  db.exec(`
    DROP INDEX IF EXISTS message_attachments_messageId;
    DROP INDEX IF EXISTS message_attachments_plaintextHash;
    DROP INDEX IF EXISTS message_attachments_path;
    DROP INDEX IF EXISTS message_attachments_all_thumbnailPath;
    DROP INDEX IF EXISTS message_attachments_all_screenshotPath;
    DROP INDEX IF EXISTS message_attachments_all_backupThumbnailPath;
  `);
}
