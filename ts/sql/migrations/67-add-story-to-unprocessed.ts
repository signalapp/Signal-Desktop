// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion67(db: Database): void {
  db.exec(
    `
    ALTER TABLE unprocessed ADD COLUMN story INTEGER;
    `
  );
}
