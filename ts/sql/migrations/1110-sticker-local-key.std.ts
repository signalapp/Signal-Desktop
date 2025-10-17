// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1110(db: Database): void {
  db.exec(`
    ALTER TABLE stickers
      ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

    ALTER TABLE stickers
      ADD COLUMN localKey TEXT;

    ALTER TABLE stickers
      ADD COLUMN size INTEGER;
  `);
}
