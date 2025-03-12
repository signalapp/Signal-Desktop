// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion86(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 86) {
    return;
  }

  db.transaction(() => {
    // The key reason for this new schema is that all of our previous schemas start with
    //   conversationId. This query is meant to find all replies to a given story, no
    //   matter the conversation.
    db.exec(
      `CREATE INDEX messages_story_replies
        ON messages (storyId, received_at, sent_at)
        WHERE isStory IS 0;
      `
    );

    db.pragma('user_version = 86');
  })();

  logger.info('updateToSchemaVersion86: success!');
}
