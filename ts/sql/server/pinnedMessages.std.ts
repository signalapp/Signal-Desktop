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
    SELECT * FROM pinnedMessages
    WHERE conversationId = ${conversationId}
    ORDER BY pinnedAt DESC
  `;
  return db.prepare(query).all<PinnedMessage>(params);
}

function _getPinnedMessageByMessageId(
  db: ReadableDB,
  messageId: string
): PinnedMessage | null {
  const [query, params] = sql`
    SELECT * FROM pinnedMessages
    WHERE messageId IS ${messageId}
  `;
  return db.prepare(query).get<PinnedMessage>(params) ?? null;
}

function _insertPinnedMessage(
  db: WritableDB,
  pinnedMessageParams: PinnedMessageParams
): PinnedMessage {
  const [query, params] = sql`
    INSERT INTO pinnedMessages (
      conversationId,
      messageId,
      pinnedAt,
      expiresAt
    ) VALUES (
      ${pinnedMessageParams.conversationId},
      ${pinnedMessageParams.messageId},
      ${pinnedMessageParams.pinnedAt},
      ${pinnedMessageParams.expiresAt}
    )
    RETURNING *;
  `;

  const row = db.prepare(query).get<PinnedMessage>(params);
  strictAssert(row != null, 'createPinnedMessage: Failed to insert');
  return row;
}

function _deletePinnedMessageById(db: WritableDB, id: PinnedMessageId): void {
  const [query, params] = sql`
    DELETE FROM pinnedMessages
    WHERE id = ${id}
  `;
  const result = db.prepare(query).run(params);
  strictAssert(
    result.changes === 1,
    `deletePinnedMessage: Expected changes: 1, Actual: ${result.changes}`
  );
}

function _truncatePinnedMessagesByConversationId(
  db: WritableDB,
  conversationId: string,
  pinnedMessagesLimit: number
): ReadonlyArray<PinnedMessageId> {
  const [query, params] = sql`
    DELETE FROM pinnedMessages
    WHERE conversationId = ${conversationId}
    AND id NOT IN (
      SELECT id FROM pinnedMessages
      WHERE conversationId = ${conversationId}
      ORDER BY pinnedAt DESC
      LIMIT ${pinnedMessagesLimit}
    )
    RETURNING id
  `;

  return db.prepare(query, { pluck: true }).all<PinnedMessageId>(params);
}

export type AppendPinnedMessageChange = Readonly<{
  inserted: PinnedMessage;
  replaced: PinnedMessageId | null;
}>;

export type AppendPinnedMessageResult = Readonly<{
  change: AppendPinnedMessageChange | null;
  // Note: The `inserted` pin may immediately be truncated
  truncated: ReadonlyArray<PinnedMessageId>;
}>;

export function appendPinnedMessage(
  db: WritableDB,
  pinnedMessagesLimit: number,
  pinnedMessageParams: PinnedMessageParams
): AppendPinnedMessageResult {
  return db.transaction(() => {
    const existing = _getPinnedMessageByMessageId(
      db,
      pinnedMessageParams.messageId
    );

    let shouldInsertOrReplace: boolean;
    if (existing == null) {
      // Always insert if there's no existing
      shouldInsertOrReplace = true;
    } else if (pinnedMessageParams.pinnedAt > existing.pinnedAt) {
      // Only replace if the pin is newer
      shouldInsertOrReplace = true;
    } else {
      shouldInsertOrReplace = false;
    }

    let change: AppendPinnedMessageChange | null = null;
    if (shouldInsertOrReplace) {
      let replaced: PinnedMessageId | null = null;

      if (existing != null) {
        _deletePinnedMessageById(db, existing.id);
        replaced = existing.id;
      }

      const inserted = _insertPinnedMessage(db, pinnedMessageParams);

      change = { inserted, replaced };
    }

    const truncated = _truncatePinnedMessagesByConversationId(
      db,
      pinnedMessageParams.conversationId,
      pinnedMessagesLimit
    );

    return { change, truncated };
  })();
}

export function deletePinnedMessageByMessageId(
  db: WritableDB,
  messageId: string
): PinnedMessageId | null {
  const [query, params] = sql`
    DELETE FROM pinnedMessages
    WHERE messageId = ${messageId}
    RETURNING id
  `;

  const result = db
    .prepare(query, { pluck: true })
    .get<PinnedMessageId>(params);

  return result ?? null;
}

export function getNextExpiringPinnedMessageAcrossConversations(
  db: ReadableDB
): PinnedMessage | null {
  const [query, params] = sql`
    SELECT * FROM pinnedMessages
    WHERE expiresAt IS NOT null
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
