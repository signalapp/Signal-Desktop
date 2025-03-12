// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';
import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion72(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 72) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE messages
        ADD COLUMN callId TEXT
        GENERATED ALWAYS AS (
          json_extract(json, '$.callHistoryDetails.callId')
        );
      ALTER TABLE messages
        ADD COLUMN callMode TEXT
        GENERATED ALWAYS AS (
          json_extract(json, '$.callHistoryDetails.callMode')
        );
      CREATE INDEX messages_call ON messages
        (conversationId, type, callMode, callId);
      `
    );

    db.pragma('user_version = 72');
  })();

  logger.info('updateToSchemaVersion72: success!');
}
