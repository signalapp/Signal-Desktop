// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion69(db: Database): void {
  db.exec(
    `
    DROP TABLE IF EXISTS groupCallRings;

    CREATE TABLE groupCallRingCancellations(
      ringId INTEGER PRIMARY KEY,
      createdAt INTEGER NOT NULL
    );
    `
  );
}
