// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';

export default function updateToSchemaVersion1400(db: WritableDB): void {
  db.exec(`
    ALTER TABLE donationReceipts DROP COLUMN paymentDetailJson;
    ALTER TABLE donationReceipts DROP COLUMN paymentType;
  `);
}
