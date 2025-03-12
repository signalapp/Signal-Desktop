// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion67(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 67) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE unprocessed ADD COLUMN story INTEGER;
      `
    );

    db.pragma('user_version = 67');
  })();

  logger.info('updateToSchemaVersion67: success!');
}
