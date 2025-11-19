// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  PinnedMessage,
  PinnedMessageId,
  PinnedMessageParams,
} from '../../types/PinnedMessage.std.js';
import { strictAssert } from '../../util/assert.std.js';
import type { ReadableDB, WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export function getPinnedMessagesForConversation(
  db: ReadableDB,
  conversationId: string
): ReadonlyArray<PinnedMessage> {
  const [query, params] = sql`
    SELECT * FROM pins
    WHERE conversationId = ${conversationId}
    ORDER BY pinnedAt DESC
  `;
  return db.prepare(query).all<PinnedMessage>(params);
}

export function createPinnedMessage(
  db: WritableDB,
  pinnedMessageParams: PinnedMessageParams
): PinnedMessage {
  const [query, params] = sql`
    INSERT INTO pinnedMessages (
      conversationId,
      messageId,
      messageSentAt,
      messageSenderAci,
      pinnedByAci,
      pinnedAt,
      expiresAt
    ) VALUES (
      ${pinnedMessageParams.conversationId},
      ${pinnedMessageParams.messageId},
      ${pinnedMessageParams.messageSentAt},
      ${pinnedMessageParams.messageSenderAci},
      ${pinnedMessageParams.pinnedByAci},
      ${pinnedMessageParams.pinnedAt},
      ${pinnedMessageParams.expiresAt}
    )
    RETURNING *;
  `;

  const row = db.prepare(query).get<PinnedMessage>(params);
  strictAssert(row != null, 'createPinnedMessage: Failed to insert');
  return row;
}

export function deletePinnedMessage(
  db: WritableDB,
  pinnedMessageId: PinnedMessageId
): void {
  const [query, params] = sql`
    DELETE FROM pinnedMessages
    WHERE id = ${pinnedMessageId}
  `;
  const result = db.prepare(query).run(params);
  strictAssert(
    result.changes === 1,
    `deletePinnedMessage: Expected changes: 1, Actual: ${result.changes}`
  );
}

export function getNextExpiringPinnedMessageAcrossConversations(
  db: ReadableDB
): PinnedMessage | null {
  const [query, params] = sql`
    SELECT * FROM pinnedMessages
    ORDER BY expiresAt ASC
    LIMIT 1
  `;
  return db.prepare(query).get<PinnedMessage>(params) ?? null;
}

export function deleteAllExpiredPinnedMessagesBefore(
  db: WritableDB,
  beforeTimestamp: number
): ReadonlyArray<PinnedMessageId> {
  const [query, params] = sql`
    DELETE FROM pinnedMessages
    WHERE expiresAt <= ${beforeTimestamp}
    RETURNING id
  `;
  return db.prepare(query, { pluck: true }).all<PinnedMessageId>(params);
}
