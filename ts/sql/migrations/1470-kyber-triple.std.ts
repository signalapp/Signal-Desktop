// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1460(db: WritableDB): void {
  db.exec(`
    CREATE TABLE kyberPreKey_triples (
      id TEXT NOT NULL REFERENCES kyberPreKeys(id) ON DELETE CASCADE,
      signedPreKeyId INTEGER NOT NULL,
      baseKey BLOB NOT NULL,
      UNIQUE(id, signedPreKeyId, baseKey) ON CONFLICT FAIL
    ) STRICT;
  `);
}
