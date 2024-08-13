// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 1130;

export function updateToSchemaVersion1130(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1130) {
    return;
  }

  db.transaction(() => {
    // This is to improve the performance of getAllStories
    db.exec(`
      CREATE INDEX messages_isStory
        ON messages(received_at, sent_at)
        WHERE isStory = 1;
    `);

    db.pragma('user_version = 1130');
  })();

  logger.info('updateToSchemaVersion1130: success!');
}
