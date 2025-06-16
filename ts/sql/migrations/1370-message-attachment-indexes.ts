// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import type { WritableDB } from '../Interface';

export const version = 1370;

export function updateToSchemaVersion1370(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1370) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      DROP INDEX IF EXISTS message_attachments_messageId;
      DROP INDEX IF EXISTS message_attachments_plaintextHash;
      DROP INDEX IF EXISTS message_attachments_path;
      DROP INDEX IF EXISTS message_attachments_all_thumbnailPath;
      DROP INDEX IF EXISTS message_attachments_all_screenshotPath;
      DROP INDEX IF EXISTS message_attachments_all_backupThumbnailPath;
    `);
    db.pragma('user_version = 1370');
  })();

  logger.info('updateToSchemaVersion1370: success!');
}
