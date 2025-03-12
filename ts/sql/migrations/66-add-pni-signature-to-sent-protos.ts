// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion66(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 66) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE sendLogPayloads
      ADD COLUMN hasPniSignatureMessage INTEGER DEFAULT 0 NOT NULL;
      `
    );

    db.pragma('user_version = 66');
  })();

  logger.info('updateToSchemaVersion66: success!');
}
