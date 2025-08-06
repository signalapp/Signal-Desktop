// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion54(db: Database): void {
  db.exec(
    `
      ALTER TABLE unprocessed ADD COLUMN receivedAtCounter INTEGER;
    `
  );
}
