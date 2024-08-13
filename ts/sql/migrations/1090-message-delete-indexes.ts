// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 1090;

export function updateToSchemaVersion1090(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1090) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      CREATE INDEX reactions_messageId
        ON reactions (messageId);
    
      CREATE INDEX storyReads_storyId
        ON storyReads (storyId);
    `);

    db.pragma('user_version = 1090');
  })();

  logger.info('updateToSchemaVersion1090: success!');
}
