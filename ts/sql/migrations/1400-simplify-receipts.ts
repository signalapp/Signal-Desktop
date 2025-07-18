// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging';
import type { WritableDB } from '../Interface';

export const version = 1400;

export function updateToSchemaVersion1400(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 1400) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      ALTER TABLE donationReceipts DROP COLUMN paymentDetailJson;
      ALTER TABLE donationReceipts DROP COLUMN paymentType;
    `);
    db.pragma('user_version = 1400');
  })();

  logger.info('updateToSchemaVersion1400: success!');
}
