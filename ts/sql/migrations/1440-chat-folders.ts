// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1440(db: WritableDB): void {
  const [query] = sql`
    CREATE TABLE chatFolders (
      id TEXT NOT NULL PRIMARY KEY,
      folderType INTEGER NOT NULL,
      name TEXT NOT NULL,
      position INTEGER NOT NULL,
      showOnlyUnread INTEGER NOT NULL,
      showMutedChats INTEGER NOT NULL,
      includeAllIndividualChats INTEGER NOT NULL,
      includeAllGroupChats INTEGER NOT NULL,
      includedConversationIds TEXT NOT NULL,
      excludedConversationIds TEXT NOT NULL,
      deletedAtTimestampMs INTEGER NOT NULL,
      storageID TEXT,
      storageVersion INTEGER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX chatFolders_by_position on chatFolders (position);
  `;

  db.exec(query);
}
