// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion62(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 62) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE sendLogPayloads ADD COLUMN urgent INTEGER;
      `
    );

    db.pragma('user_version = 62');
  })();

  logger.info('updateToSchemaVersion62: success!');
}
