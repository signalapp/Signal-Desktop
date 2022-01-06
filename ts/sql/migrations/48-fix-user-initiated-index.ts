// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion48(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 48) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX   message_user_initiated;

      CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);
      `
    );

    db.pragma('user_version = 48');
  })();

  logger.info('updateToSchemaVersion48: success!');
}
