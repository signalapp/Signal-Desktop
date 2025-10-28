// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { sql } from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1300(db: WritableDB): void {
  const [query] = sql`
    ALTER TABLE sticker_references
      ADD COLUMN stickerId INTEGER NOT NULL DEFAULT -1;
    ALTER TABLE sticker_references
      ADD COLUMN isUnresolved INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX unresolved_sticker_refs
    ON sticker_references (packId, stickerId)
    WHERE isUnresolved IS 1;
  `;
  db.exec(query);
}
