// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 940;

export function updateToSchemaVersion940(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 940) {
    return;
  }

  db.transaction(() => {
    // This was a migration that disabled secure-delete and rebuilt the index
    db.pragma('user_version = 940');
  })();

  logger.info('updateToSchemaVersion940: success!');
}
