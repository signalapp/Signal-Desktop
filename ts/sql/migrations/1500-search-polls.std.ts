// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export const createMessagesOnInsertTrigger = sql`
  CREATE TRIGGER messages_on_insert AFTER INSERT ON messages
    WHEN new.isSearchable IS 1
    BEGIN
      INSERT INTO messages_fts
      (rowid, body)
      VALUES
      (new.rowid, new.searchableText);
    END;
`[0];

const createMessagesOnUpdateTrigger = sql`
  CREATE TRIGGER messages_on_update AFTER UPDATE ON messages
    WHEN
      new.isSearchable IS 1 AND old.searchableText IS NOT new.searchableText
    BEGIN
      UPDATE messages_fts SET body = new.searchableText WHERE rowId = new.rowId;
    END;
`[0];

export default function updateToSchemaVersion1500(db: WritableDB): void {
  db.exec(
    `ALTER TABLE messages ADD COLUMN isSearchable INT 
      GENERATED ALWAYS AS (isViewOnce IS NOT 1 AND storyId IS NULL) VIRTUAL;`
  );

  // Must be kept in sync with logic in getSearchableTextAndBodyRanges
  db.exec(`
    ALTER TABLE messages ADD COLUMN searchableText TEXT GENERATED ALWAYS AS (
      CASE
        WHEN json->'poll' IS NOT NULL THEN json->'poll'->>'question'
        ELSE body
      END
      ) VIRTUAL;
  `);

  // If the messages_on_insert query is updated, enableMessageInsertTriggersAndBackfill
  // and backfillMessagesFtsTable must be as well
  db.exec('DROP TRIGGER IF EXISTS messages_on_insert;');
  db.exec(createMessagesOnInsertTrigger);

  db.exec('DROP TRIGGER IF EXISTS messages_on_update;');
  db.exec(createMessagesOnUpdateTrigger);
}
