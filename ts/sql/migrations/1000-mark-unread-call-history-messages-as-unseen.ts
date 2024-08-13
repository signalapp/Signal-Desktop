// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import type { LoggerType } from '../../types/Logging';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';
import { strictAssert } from '../../util/assert';
import { sql, sqlConstant } from '../util';

export const version = 1000;

const READ_STATUS_UNREAD = sqlConstant(ReadStatus.Unread);
const READ_STATUS_READ = sqlConstant(ReadStatus.Read);
const SEEN_STATUS_UNSEEN = sqlConstant(SeenStatus.Unseen);

export function updateToSchemaVersion1000(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1000) {
    return;
  }

  db.transaction(() => {
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

    db.pragma('user_version = 1000');
  })();

  logger.info('updateToSchemaVersion1000: success!');
}
