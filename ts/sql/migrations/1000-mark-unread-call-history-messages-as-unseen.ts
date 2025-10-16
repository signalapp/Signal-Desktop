// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/sqlcipher';

import { ReadStatus } from '../../messages/MessageReadStatus.std.js';
import { SeenStatus } from '../../MessageSeenStatus.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { sql, sqlConstant } from '../util.std.js';

const READ_STATUS_UNREAD = sqlConstant(ReadStatus.Unread);
const READ_STATUS_READ = sqlConstant(ReadStatus.Read);
const SEEN_STATUS_UNSEEN = sqlConstant(SeenStatus.Unseen);

export default function updateToSchemaVersion1000(db: Database): void {
  const [selectQuery] = sql`
    SELECT id
    FROM messages
    WHERE messages.type = 'call-history'
      AND messages.readStatus IS ${READ_STATUS_UNREAD}
  `;

  const rows = db.prepare(selectQuery).all();

  for (const row of rows) {
    const { id } = row;
    strictAssert(id != null, 'message id must exist');

    const [updateQuery, updateParams] = sql`
      UPDATE messages
      SET
        json = JSON_PATCH(json, ${JSON.stringify({
          readStatus: ReadStatus.Read,
          seenStatus: SeenStatus.Unseen,
        })}),
        readStatus = ${READ_STATUS_READ},
        seenStatus = ${SEEN_STATUS_UNSEEN}
      WHERE id = ${id}
    `;

    db.prepare(updateQuery).run(updateParams);
  }
}
