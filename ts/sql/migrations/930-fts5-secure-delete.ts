// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export const version = 930;

export function updateToSchemaVersion930(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 930) {
    return;
  }

  db.transaction(() => {
    // This was a migration that enabled 'secure-delete' in FTS

    db.pragma('user_version = 930');
  })();

  logger.info('updateToSchemaVersion930: success!');
}
