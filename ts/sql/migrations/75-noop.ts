// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion75(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 75) {
    return;
  }

  db.transaction(() => {
    // This was previously a FTS5 migration, but we had to reorder the
    // migrations for backports.
    // See: migrations 76 and 77.
    db.pragma('user_version = 75');
  })();

  logger.info('updateToSchemaVersion75: success!');
}
