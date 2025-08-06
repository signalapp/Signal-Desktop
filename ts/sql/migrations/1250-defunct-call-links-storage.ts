// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1250(db: Database): void {
  db.exec(`
    ALTER TABLE defunctCallLinks ADD COLUMN storageID TEXT;
    ALTER TABLE defunctCallLinks ADD COLUMN storageVersion INTEGER;
    ALTER TABLE defunctCallLinks ADD COLUMN storageUnknownFields BLOB;
    ALTER TABLE defunctCallLinks ADD COLUMN storageNeedsSync INTEGER NOT NULL DEFAULT 0;
  `);
}
