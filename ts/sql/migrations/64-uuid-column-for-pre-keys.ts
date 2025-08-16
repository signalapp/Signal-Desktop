// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion64(db: Database): void {
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
}
