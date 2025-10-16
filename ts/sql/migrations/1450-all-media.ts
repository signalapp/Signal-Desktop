// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1450(db: WritableDB): void {
  db.exec(`
    ALTER TABLE message_attachments
      ADD COLUMN messageType TEXT;
    ALTER TABLE message_attachments
      ADD COLUMN receivedAt INTEGER;
    ALTER TABLE message_attachments
      ADD COLUMN receivedAtMs INTEGER;
    ALTER TABLE message_attachments
      ADD COLUMN isViewOnce INTEGER;
  `);

  // Backfill
  db.exec(`
    UPDATE message_attachments
    SET
      messageType = messages.type,
      receivedAt = messages.received_at,
      receivedAtMs = messages.received_at_ms,
      isViewOnce = messages.isViewOnce
    FROM (
      SELECT id, type, received_at, received_at_ms, isViewOnce
      FROM messages
    ) AS messages
    WHERE
      message_attachments.messageId IS messages.id
  `);

  // Index
  db.exec(`
    CREATE INDEX message_attachments_getOlderMedia ON message_attachments
    (conversationId, attachmentType, receivedAt DESC, sentAt DESC)
    WHERE
      editHistoryIndex IS -1 AND
      messageType IN ('incoming', 'outgoing') AND
      isViewOnce IS NOT 1
  `);
}
