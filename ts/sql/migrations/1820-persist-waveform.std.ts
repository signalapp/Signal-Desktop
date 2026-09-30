// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.ts';

export default function updateToSchemaVersion1820(db: WritableDB): void {
  db.exec(`
    ALTER TABLE message_attachments
      ADD COLUMN audioWaveform BLOB;
  `);
}
