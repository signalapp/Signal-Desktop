// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1170(db: Database): void {
  const [query] = sql`
    DROP INDEX IF EXISTS messages_callHistory_markReadBefore;
    CREATE INDEX messages_callHistory_markReadBefore
      ON messages (type, seenStatus, received_at DESC)
      WHERE type IS 'call-history';
  `;
  db.exec(query);
}
