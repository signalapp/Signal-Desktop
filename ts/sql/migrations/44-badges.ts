// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion44(db: Database): void {
  db.exec(
    `
    CREATE TABLE badges(
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      descriptionTemplate TEXT NOT NULL
    );

    CREATE TABLE badgeImageFiles(
      badgeId TEXT REFERENCES badges(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      'order' INTEGER NOT NULL,
      url TEXT NOT NULL,
      localPath TEXT,
      theme TEXT NOT NULL
    );
    `
  );
}
