// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1460(db: WritableDB): void {
  db.exec(`
    ALTER TABLE message_attachments
      ADD COLUMN duration REAL;
  `);
}
