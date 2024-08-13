// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import type { WritableDB } from '../Interface';
import { getOurUuid } from './41-uuid-keys';

export const version = 1020;

export function updateToSchemaVersion1020(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1020) {
    return;
  }

  db.transaction(() => {
    const ourAci = getOurUuid(db);

    if (ourAci == null) {
      logger.info('updateToSchemaVersion1020: not linked');
      db.pragma('user_version = 1020');
      return;
    }

    const [selectQuery, selectParams] = sql`
      SELECT id FROM conversations
      WHERE serviceId IS ${ourAci}
    `;
    const ourConversationId = db.prepare(selectQuery).pluck().get(selectParams);
    if (ourConversationId == null) {
      logger.error('updateToSchemaVersion1020: no conversation');
      db.pragma('user_version = 1020');
      return;
    }

    const [deleteQuery, deleteParams] = sql`
      DELETE FROM messages
      WHERE
        conversationId IS ${ourConversationId} AND
        type IS 'conversation-merge'
    `;
    const { changes } = db.prepare(deleteQuery).run(deleteParams);
    if (changes !== 0) {
      logger.warn(`updateToSchemaVersion1020: removed ${changes} self merges`);
    }

    db.pragma('user_version = 1020');
  })();

  logger.info('updateToSchemaVersion1020: success!');
}
