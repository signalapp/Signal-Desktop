// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoggerType } from '../../types/Logging.std.ts';
import type { WritableDB } from '../Interface.std.ts';
import { sql } from '../util.std.ts';

export default function updateToSchemaVersion1690(
  db: WritableDB,
  logger: LoggerType
): void {
  const [query, params] = sql`
    UPDATE messages AS message
      SET json = json_remove(
        json_set(
          message.json,
          '$.pollTerminateNotification.pollTimestamp',
          COALESCE(
            (
              SELECT poll.timestamp
              FROM messages AS poll
              WHERE poll.id = message.json ->> '$.pollTerminateNotification.pollMessageId'
            ),
            0
          )
        ),
        '$.pollTerminateNotification.pollMessageId'
      )
      WHERE
        message.type IS 'poll-terminate' AND
        message.json -> '$.pollTerminateNotification' IS NOT NULL;
  `;

  const result = db.prepare(query).run(params);

  logger.info(`Updated ${result.changes} poll terminate notifications`);
}
