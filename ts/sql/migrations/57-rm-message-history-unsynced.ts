// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion57(db: Database): void {
  db.exec(
    `
    DELETE FROM messages
    WHERE type IS 'message-history-unsynced';
    `
  );
}
