// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1380(db: WritableDB): void {
  db.exec(`
    CREATE TABLE donationReceipts(
      id TEXT NOT NULL PRIMARY KEY,
      currencyType TEXT NOT NULL,
      paymentAmount INTEGER NOT NULL,
      paymentDetailJson TEXT NOT NULL,
      paymentType TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    ) STRICT;

    CREATE INDEX donationReceipts_byTimestamp on donationReceipts(timestamp);
  `);
}
