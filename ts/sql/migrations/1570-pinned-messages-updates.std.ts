// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { WritableDB } from '../Interface.std.js';
import { sql } from '../util.std.js';

export default function updateToSchemaVersion1570(db: WritableDB): void {
  const [query] = sql`
    -- We only need the 'messageId' column
    ALTER TABLE pinnedMessages DROP COLUMN messageSentAt;
    ALTER TABLE pinnedMessages DROP COLUMN messageSenderAci;

    -- We dont need to know who pinned the message
    ALTER TABLE pinnedMessages DROP COLUMN pinnedByAci;
  `;
  db.exec(query);
}
