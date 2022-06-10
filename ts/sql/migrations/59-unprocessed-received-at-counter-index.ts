// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion59(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 59) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
        CREATE INDEX unprocessed_byReceivedAtCounter ON unprocessed
          (receivedAtCounter)
      `
    );

    db.pragma('user_version = 59');
  })();
  logger.info('updateToSchemaVersion59: success!');
}
