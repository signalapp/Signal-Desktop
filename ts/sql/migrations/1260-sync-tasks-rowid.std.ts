// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1260(db: Database): void {
  const [query] = sql`
    DROP INDEX IF EXISTS syncTasks_order;
    CREATE INDEX syncTasks_delete ON syncTasks (attempts DESC);
  `;

  db.exec(query);
}
