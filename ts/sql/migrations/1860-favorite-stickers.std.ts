// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';

export default function updateToSchemaVersion1860(db: WritableDB): void {
  const [query] = sql`
    CREATE TABLE favorite_stickers (
      packId TEXT NOT NULL,
      stickerId INTEGER NOT NULL,
      packKey TEXT,
      favoritedAtTimestampMs INTEGER,
      deletedAtTimestampMs INTEGER,
      status TEXT NOT NULL,
      storageID TEXT,
      storageVersion INTEGER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL DEFAULT 0,

      PRIMARY KEY (packId, stickerId)
    ) STRICT;

    CREATE INDEX favorite_stickers_by_favoritedAtTimestampMs on favorite_stickers (favoritedAtTimestampMs);
  `;

  db.exec(query);
}
