// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1150(db: Database): void {
  db.exec(`
    -- All future conversations will start from '1'
    ALTER TABLE conversations
      ADD COLUMN expireTimerVersion INTEGER NOT NULL DEFAULT 1;

    -- All current conversations will start from '2'
    UPDATE conversations SET expireTimerVersion = 2;
  `);
}
