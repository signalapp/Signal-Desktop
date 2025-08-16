// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion980(db: Database): void {
  db.exec(`
    ALTER TABLE reactions ADD COLUMN timestamp NUMBER;

    CREATE INDEX reactions_byTimestamp
    ON reactions
    (fromId, timestamp);
  `);
}
