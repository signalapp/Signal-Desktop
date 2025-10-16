// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1350(db: Database): void {
  const [query] = sql`
    CREATE TABLE notificationProfiles(
      id TEXT PRIMARY KEY NOT NULL,

      name TEXT NOT NULL,
      emoji TEXT,
      /* A numeric representation of a color, like 0xAARRGGBB */
      color INTEGER NOT NULL,

      createdAtMs INTEGER NOT NULL,

      allowAllCalls INTEGER NOT NULL,
      allowAllMentions INTEGER NOT NULL,

      /* A JSON array of conversationId strings */
      allowedMembersJson TEXT NOT NULL,
      scheduleEnabled INTEGER NOT NULL,

      /* 24-hour clock int, 0000-2359 (e.g., 15, 900, 1130, 2345) */
      scheduleStartTime INTEGER,
      scheduleEndTime INTEGER,

      /* A JSON object with true/false for each of the numbers in the Protobuf enum */
      scheduleDaysEnabledJson TEXT,
      deletedAtTimestampMs INTEGER,

      storageID TEXT,
      storageVersion INTEGER,
      storageUnknownFields BLOB,
      storageNeedsSync INTEGER NOT NULL DEFAULT 0
    ) STRICT;
  `;

  db.exec(query);
}
