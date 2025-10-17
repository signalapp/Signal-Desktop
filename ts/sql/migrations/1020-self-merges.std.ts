// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import { sql } from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';
import { getOurUuid } from './41-uuid-keys.std.js';

export default function updateToSchemaVersion1020(
  db: WritableDB,
  logger: LoggerType
): void {
  const ourAci = getOurUuid(db);

  if (ourAci == null) {
    logger.info('not linked');
    return;
  }

  const [selectQuery, selectParams] = sql`
    SELECT id FROM conversations
    WHERE serviceId IS ${ourAci}
  `;
  const ourConversationId = db
    .prepare(selectQuery, {
      pluck: true,
    })
    .get(selectParams);
  if (ourConversationId == null) {
    logger.error('no conversation');
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
    logger.warn(`removed ${changes} self merges`);
  }
}
