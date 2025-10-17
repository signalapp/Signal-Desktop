// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import { sql } from '../util.std.js';

export default function updateToSchemaVersion1050(db: Database): void {
  const [createTables] = sql`
    DROP TABLE IF EXISTS groupSendCombinedEndorsement;
    DROP TABLE IF EXISTS groupSendMemberEndorsement;

    -- From GroupSendEndorsementsResponse->ReceivedEndorsements in libsignal
    -- this is the combined endorsement for all group members
    CREATE TABLE groupSendCombinedEndorsement (
      groupId TEXT NOT NULL PRIMARY KEY, -- Only one endorsement per group
      expiration INTEGER NOT NULL, -- Unix timestamp in seconds
      endorsement BLOB NOT NULL
    ) STRICT;

    -- From GroupSendEndorsementsResponse->ReceivedEndorsements in libsignal
    -- these are the individual endorsements for each group member
    CREATE TABLE groupSendMemberEndorsement (
      groupId TEXT NOT NULL,
      memberAci TEXT NOT NULL,
      expiration INTEGER NOT NULL, -- Unix timestamp in seconds
      endorsement BLOB NOT NULL,
      PRIMARY KEY (groupId, memberAci) -- Only one endorsement per group member
    ) STRICT;
  `;

  db.exec(createTables);
}
