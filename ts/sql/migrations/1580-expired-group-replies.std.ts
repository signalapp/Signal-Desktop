// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.js';
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1580(
  db: WritableDB,
  logger: LoggerType
): void {
  const [query] = sql`
      DELETE FROM messages 
      WHERE id IN (
        SELECT messages.id from messages
        INNER JOIN conversations ON messages.conversationId = conversations.id 
        WHERE 
          conversations.type = 'group'
          AND messages.storyId IS NOT NULL  
          AND NOT EXISTS (
            SELECT 1 FROM messages AS messages_exists
            WHERE messages.storyId = messages_exists.id AND messages_exists.isErased IS NOT 1
          )
      )
  `;
  const result = db.prepare(query).run();
  if (result.changes > 0) {
    logger.warn(
      `Deleted ${result.changes} group story replies without matching stories`
    );
  }
}
