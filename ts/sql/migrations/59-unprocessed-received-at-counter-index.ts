// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion59(db: Database): void {
  db.exec(
    `
      CREATE INDEX unprocessed_byReceivedAtCounter ON unprocessed
        (receivedAtCounter)
    `
  );
}
