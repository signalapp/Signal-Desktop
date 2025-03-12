// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion79(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 79) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      DROP INDEX   messages_hasVisualMediaAttachments;
      CREATE INDEX messages_hasVisualMediaAttachments
        ON messages (
          conversationId, isStory, storyId,
          hasVisualMediaAttachments, received_at, sent_at
        )
        WHERE hasVisualMediaAttachments IS 1;
    `);

    db.pragma('user_version = 79');
  })();

  logger.info('updateToSchemaVersion79: success!');
}
