// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sql } from '../util.std.ts';

import type { WritableDB } from '../Interface.std.ts';

export default function updateToSchemaVersion1880(db: WritableDB): void {
  const [query] = sql`
    CREATE TABLE linkedDevices (
      id INTEGER PRIMARY KEY NOT NULL,
      
      createdAt INTEGER,
      lastSeenAt INTEGER NOT NULL,
      name TEXT,
      registrationId INTEGER NOT NULL
    ) STRICT;
  `;
  db.exec(query);
}
