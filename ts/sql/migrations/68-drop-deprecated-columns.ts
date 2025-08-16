// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion68(db: Database): void {
  db.exec(
    `
    ALTER TABLE messages
      DROP COLUMN deprecatedSourceDevice;
    ALTER TABLE unprocessed
      DROP COLUMN deprecatedSourceDevice;
    `
  );
}
