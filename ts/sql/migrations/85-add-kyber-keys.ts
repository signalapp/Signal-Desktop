// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import type { LoggerType } from '../../types/Logging';

export default function updateToSchemaVersion85(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 85) {
    return;
  }

  db.transaction(() => {
    db.exec(
      `CREATE TABLE kyberPreKeys(
        id STRING PRIMARY KEY NOT NULL,
        json TEXT NOT NULL,
        ourUuid STRING
          GENERATED ALWAYS AS (json_extract(json, '$.ourUuid'))
      );`
    );

    // To manage our ACI or PNI keys quickly
    db.exec('CREATE INDEX kyberPreKeys_ourUuid ON kyberPreKeys (ourUuid);');

    // Add time to all existing preKeys to allow us to expire them
    const now = Date.now();
    db.exec(
      `UPDATE preKeys SET
        json = json_set(json, '$.createdAt', ${now});
      `
    );

    db.pragma('user_version = 85');
  })();

  logger.info('updateToSchemaVersion85: success!');
}
