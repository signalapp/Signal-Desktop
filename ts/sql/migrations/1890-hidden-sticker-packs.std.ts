// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';

export default function updateToSchemaVersion1890(db: WritableDB): void {
  const [query] = sql`
    CREATE TABLE hidden_sticker_packs (
      packId TEXT NOT NULL,
      packKey TEXT,
      unhiddenAtTimestampMs INTEGER,
      storageID TEXT,
      storageVersion INTEGER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL DEFAULT 0,

      PRIMARY KEY (packId)
    ) STRICT;
  `;

  db.exec(query);
}
