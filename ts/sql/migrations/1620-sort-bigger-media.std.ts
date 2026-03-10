// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1620(db: WritableDB): void {
  db.exec(`
    CREATE INDEX message_attachments_sortBiggerMedia ON message_attachments
    (conversationId, attachmentType, size DESC, receivedAt DESC, sentAt DESC)
    WHERE
      editHistoryIndex IS -1 AND
      messageType IN ('incoming', 'outgoing') AND
      isViewOnce IS NOT 1;
  `);
}
