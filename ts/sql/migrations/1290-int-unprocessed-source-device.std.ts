// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { sql } from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1290(db: WritableDB): void {
  const [query] = sql`
    ALTER TABLE unprocessed RENAME COLUMN sourceDevice TO legacySourceDevice;
    ALTER TABLE unprocessed ADD COLUMN sourceDevice INTEGER;

    UPDATE unprocessed
    SET sourceDevice = legacySourceDevice;

    ALTER TABLE unprocessed DROP COLUMN legacySourceDevice;
  `;
  db.exec(query);
}
