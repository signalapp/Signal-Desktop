// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion77(db: Database): void {
  db.exec(
    `
    -- Create FTS table with custom tokenizer from
    -- @signalapp/sqlcipher.

    DROP TABLE messages_fts;

    CREATE VIRTUAL TABLE messages_fts USING fts5(
      body,
      tokenize = 'signal_tokenizer'
    );

    -- Reindex messages
    -- Based on messages_on_insert trigger from migrations/45-stories.ts

    INSERT INTO messages_fts (rowid, body)
    SELECT rowid, body
    FROM messages
    WHERE isViewOnce IS NOT 1 AND storyId IS NULL;
    `
  );
}
