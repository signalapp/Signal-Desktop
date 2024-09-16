// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';

export const version = 1200;
export function updateToSchemaVersion1200(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1200) {
    return;
  }

  db.transaction(() => {
    // The standard getNextAttachmentDownloadJobs query uses active & source conditions,
    // ordered by received_at
    db.exec(`      
        CREATE INDEX attachment_downloads_active_source_receivedAt
            ON attachment_downloads (
                active, source, receivedAt
            );
    `);

    db.pragma('user_version = 1200');
  })();
  logger.info('updateToSchemaVersion1200: success!');
}
