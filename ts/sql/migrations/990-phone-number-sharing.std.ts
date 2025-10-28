// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

export default function updateToSchemaVersion990(db: Database): void {
  db.exec(`
    UPDATE conversations
    SET json = json_remove(
      json_insert(
        json,
        '$.sharingPhoneNumber',
        iif(
          json ->> '$.notSharingPhoneNumber',
          -- We flip the value from false to true, and vice versa
          json('false'),
          json('true')
        )
      ),
      '$.notSharingPhoneNumber'
    )
    -- Default value of '$.notSharingPhoneNumber' is true and
    -- the default value of '$.sharingPhoneNumber' is false so we don't have
    -- to do anything if the field wasn't present.
    WHERE json ->> '$.notSharingPhoneNumber' IS NOT NULL;
  `);
}
