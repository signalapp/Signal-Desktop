// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1190(db: Database): void {
  db.exec(`
    ALTER TABLE callLinks ADD COLUMN storageID TEXT;
    ALTER TABLE callLinks ADD COLUMN storageVersion INTEGER;
    ALTER TABLE callLinks ADD COLUMN storageUnknownFields BLOB;
    ALTER TABLE callLinks ADD COLUMN storageNeedsSync INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE callLinks ADD COLUMN deletedAt INTEGER;
  `);
  db.prepare(
    `
    UPDATE callLinks
      SET deletedAt = $deletedAt
      WHERE deleted = 1;
    `
  ).run({
    deletedAt: new Date().getTime(),
  });
}
