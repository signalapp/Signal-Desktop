// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion70(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 70) {
    return;
  }

  db.transaction(() => {
    // Used in `getAllStories`.
    db.exec(
      `
      CREATE INDEX messages_by_storyId ON messages (storyId);
      `
    );

    db.pragma('user_version = 70');
  })();

  logger.info('updateToSchemaVersion70: success!');
}
