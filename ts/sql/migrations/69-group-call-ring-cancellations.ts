// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion69(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 69) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      DROP TABLE IF EXISTS groupCallRings;

      CREATE TABLE groupCallRingCancellations(
        ringId INTEGER PRIMARY KEY,
        createdAt INTEGER NOT NULL
      );
      `
    );

    db.pragma('user_version = 69');
  })();

  logger.info('updateToSchemaVersion69: success!');
}
