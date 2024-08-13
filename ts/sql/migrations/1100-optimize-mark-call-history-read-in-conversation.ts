// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';

export const version = 1100;

export function updateToSchemaVersion1100(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1100) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      -- Fix: Query went from readStatus to seenStatus but index wasn't updated
      DROP INDEX IF EXISTS messages_callHistory_readStatus;
      DROP INDEX IF EXISTS messages_callHistory_seenStatus;
      CREATE INDEX messages_callHistory_seenStatus
        ON messages (type, seenStatus)
        WHERE type IS 'call-history';

      -- Update to index created in 89: add sent_at to make it covering, and where clause to make it smaller
      DROP INDEX IF EXISTS messages_call;
      CREATE INDEX messages_call ON messages
        (type, conversationId, callId, sent_at)
        WHERE type IS 'call-history';

      -- Update to index created in 89: add callId and peerId to make it covering
      DROP INDEX IF EXISTS callsHistory_order;
      CREATE INDEX callsHistory_order ON callsHistory
        (timestamp DESC, callId, peerId);

      -- Update to index created in 89: add timestamp for querying by order and callId to make it covering
      DROP INDEX IF EXISTS callsHistory_byConversation;
      DROP INDEX IF EXISTS callsHistory_byConversation_order;
      CREATE INDEX callsHistory_byConversation_order ON callsHistory (peerId, timestamp DESC, callId);

      -- Optimize markAllCallHistoryRead
      DROP INDEX IF EXISTS messages_callHistory_markReadBefore;
      CREATE INDEX messages_callHistory_markReadBefore
        ON messages (type, seenStatus, sent_at DESC)
        WHERE type IS 'call-history';

      -- Optimize markAllCallHistoryReadInConversation
      DROP INDEX IF EXISTS messages_callHistory_markReadByConversationBefore;
      CREATE INDEX messages_callHistory_markReadByConversationBefore
        ON messages (type, conversationId, seenStatus, sent_at DESC)
        WHERE type IS 'call-history';
    `;

    db.exec(query);

    db.pragma('user_version = 1100');
  })();

  logger.info('updateToSchemaVersion1100: success!');
}
