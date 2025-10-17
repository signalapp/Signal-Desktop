// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion1230(db: Database): void {
  db.exec(`
    DROP INDEX IF EXISTS callLinks_adminKey;

    CREATE INDEX callLinks_adminKey
      ON callLinks (adminKey);
  `);
}
