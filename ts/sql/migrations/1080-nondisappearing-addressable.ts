// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export const version = 1080;

export function updateToSchemaVersion1080(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1080) {
    return;
  }

  db.transaction(() => {
    db.exec(`
      CREATE INDEX messages_by_date_addressable_nondisappearing
        ON messages (
          conversationId, isAddressableMessage, received_at, sent_at
      ) WHERE expireTimer IS NULL;
    `);

    db.pragma('user_version = 1080');
  })();

  logger.info('updateToSchemaVersion1080: success!');
}
