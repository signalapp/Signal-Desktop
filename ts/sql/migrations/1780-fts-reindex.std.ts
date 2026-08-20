// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.ts';

export default function updateToSchemaVersion1780(db: WritableDB): void {
  // @signalapp/sqlcipher@4.0.5 changes the offsets of tokens so we have to
  // rebuild.
  db.exec(`
    INSERT INTO messages_fts(messages_fts) VALUES('rebuild');
  `);
}
