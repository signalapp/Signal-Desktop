// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import type { WritableDB } from '../Interface';

export const version = 1380;

export function updateToSchemaVersion1380(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1380) {
    return;
  }

  db.transaction(() => {
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
    db.pragma('user_version = 1380');
  })();

  logger.info('updateToSchemaVersion1380: success!');
}
