// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion68(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 68) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE messages
        DROP COLUMN deprecatedSourceDevice;
      ALTER TABLE unprocessed
        DROP COLUMN deprecatedSourceDevice;
      `
    );

    db.pragma('user_version = 68');
  })();

  logger.info('updateToSchemaVersion68: success!');
}
