// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion66(db: Database): void {
  db.exec(
    `
    ALTER TABLE sendLogPayloads
    ADD COLUMN hasPniSignatureMessage INTEGER DEFAULT 0 NOT NULL;
    `
  );
}
