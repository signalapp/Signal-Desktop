// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import { sql } from '../util.std.js';

export default function updateToSchemaVersion1010(db: Database): void {
  const [createTable] = sql`
    CREATE TABLE callLinks (
      roomId TEXT NOT NULL PRIMARY KEY,
      rootKey BLOB NOT NULL,
      adminKey BLOB,
      name TEXT NOT NULL,
      -- Enum which stores CallLinkRestrictions from ringrtc
      restrictions INTEGER NOT NULL,
      revoked INTEGER NOT NULL,
      expiration INTEGER
    ) STRICT;
  `;

  db.exec(createTable);
}
