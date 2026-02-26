// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1670(db: WritableDB): void {
  const [query] = sql`
    ALTER TABLE callLinks DROP COLUMN epoch;
    ALTER TABLE defunctCallLinks DROP COLUMN epoch;
  `;
  db.exec(query);
}
