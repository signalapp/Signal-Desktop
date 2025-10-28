// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sql } from '../util.std.js';
import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1320(db: WritableDB): void {
  const [query] = sql`
    DROP INDEX unprocessed_timestamp;

    ALTER TABLE unprocessed
      ADD COLUMN receivedAtDate INTEGER DEFAULT 0 NOT NULL;

    UPDATE unprocessed
      SET receivedAtDate = timestamp;

    CREATE INDEX unprocessed_byReceivedAtDate ON unprocessed
      (receivedAtDate);
  `;
  db.exec(query);
}
