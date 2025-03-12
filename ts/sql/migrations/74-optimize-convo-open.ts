// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion74(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 74) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      -- Previously: (isUserInitiatedMessage)
      DROP INDEX message_user_initiated;

      CREATE INDEX message_user_initiated ON messages (conversationId, isUserInitiatedMessage);

      -- Previously: (unread, conversationId)
      DROP INDEX reactions_unread;

      CREATE INDEX reactions_unread ON reactions (
        conversationId,
        unread
      );
      `
    );

    db.pragma('user_version = 74');
  })();

  logger.info('updateToSchemaVersion74: success!');
}
