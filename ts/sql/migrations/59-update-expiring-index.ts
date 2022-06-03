// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion59(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 59) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      DROP INDEX expiring_message_by_conversation_and_received_at;

      CREATE INDEX expiring_message_by_conversation_and_received_at
        ON messages
        (
          conversationId,
          storyId
          expirationStartTimestamp,
          expireTimer,
          received_at,
        )
        WHERE isStory IS 0 AND type IS 'incoming';
      `
    );

    db.pragma('user_version = 59');
  })();

  logger.info('updateToSchemaVersion59: success!');
}
