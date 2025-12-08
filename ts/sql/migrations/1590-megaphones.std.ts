// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1590(db: WritableDB): void {
  const [query] = sql`
    CREATE TABLE megaphones (
      id TEXT NOT NULL PRIMARY KEY,
      desktopMinVersion TEXT,
      priority INTEGER NOT NULL,
      dontShowBeforeEpochMs INTEGER NOT NULL,
      dontShowAfterEpochMs INTEGER NOT NULL,
      showForNumberOfDays INTEGER NOT NULL,
      primaryCtaId TEXT,
      secondaryCtaId TEXT,
      primaryCtaDataJson TEXT,
      secondaryCtaDataJson TEXT,
      conditionalId TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      primaryCtaText TEXT,
      secondaryCtaText TEXT,
      imagePath TEXT,
      localeFetched TEXT NOT NULL,
      shownAt INTEGER,
      snoozedAt INTEGER,
      snoozeCount INTEGER NOT NULL,
      isFinished INTEGER NOT NULL
    ) STRICT;
  `;

  db.exec(query);
}
