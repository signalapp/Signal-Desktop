// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1140(db: Database): void {
  db.exec(`
    DROP INDEX IF EXISTS callLinks_deleted;

    ALTER TABLE callLinks
      ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX callLinks_deleted
      ON callLinks (deleted, roomId);
  `);
}
