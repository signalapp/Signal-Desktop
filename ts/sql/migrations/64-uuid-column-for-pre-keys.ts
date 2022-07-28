// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'better-sqlite3';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion64(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 64) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `
      ALTER TABLE preKeys
        ADD COLUMN ourUuid STRING
        GENERATED ALWAYS AS (json_extract(json, '$.ourUuid'));

      CREATE INDEX preKeys_ourUuid ON preKeys (ourUuid);

      ALTER TABLE signedPreKeys
        ADD COLUMN ourUuid STRING
        GENERATED ALWAYS AS (json_extract(json, '$.ourUuid'));

      CREATE INDEX signedPreKeys_ourUuid ON signedPreKeys (ourUuid);
      `
    );

    db.pragma('user_version = 64');
  })();

  logger.info('updateToSchemaVersion64: success!');
}
