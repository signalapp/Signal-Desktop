// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion970(db: Database): void {
  db.exec(`
    INSERT INTO messages_fts(messages_fts) VALUES ('optimize');
  `);
}
