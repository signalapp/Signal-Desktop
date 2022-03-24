// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion54(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 54) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
        ALTER TABLE unprocessed ADD COLUMN receivedAtCounter INTEGER;
      `
    );

    db.pragma('user_version = 54');
  })();
  logger.info('updateToSchemaVersion54: success!');
}
