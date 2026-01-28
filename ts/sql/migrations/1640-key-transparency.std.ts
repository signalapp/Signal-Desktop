// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1640(db: WritableDB): void {
  db.exec(`
    CREATE TABLE key_transparency_account_data (
      aci TEXT NOT NULL PRIMARY KEY,
      data BLOB NOT NULL
    ) STRICT;
  `);
}
