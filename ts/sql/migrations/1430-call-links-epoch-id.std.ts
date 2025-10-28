// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { type WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1430(db: WritableDB): void {
  db.exec(`
    ALTER TABLE callLinks
      ADD COLUMN epoch BLOB;
  `);

  db.exec(`
    ALTER TABLE defunctCallLinks
      ADD COLUMN epoch BLOB;
  `);
}
