// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1330(db: Database): void {
  const [query] = sql`
    CREATE INDEX syncTasks_type ON syncTasks (type);
  `;

  db.exec(query);
}
