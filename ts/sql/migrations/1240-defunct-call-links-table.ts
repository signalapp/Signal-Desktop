// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import { sql } from '../util.std.js';

export default function updateToSchemaVersion1240(db: Database): void {
  const [createTable] = sql`
    CREATE TABLE defunctCallLinks (
      roomId TEXT NOT NULL PRIMARY KEY,
      rootKey BLOB NOT NULL,
      adminKey BLOB
    ) STRICT;
  `;

  db.exec(createTable);
}
