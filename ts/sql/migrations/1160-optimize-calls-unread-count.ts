// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/better-sqlite3';
import type { LoggerType } from '../../types/Logging';
import { sql, sqlConstant } from '../util';
import { CallDirection, CallStatusValue } from '../../types/CallDisposition';

export const version = 1160;

const CALL_STATUS_MISSED = sqlConstant(CallStatusValue.Missed);
const CALL_DIRECTION_INCOMING = sqlConstant(CallDirection.Incoming);

export function updateToSchemaVersion1160(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 1160) {
    return;
  }

  db.transaction(() => {
    const [query] = sql`
      DROP INDEX IF EXISTS callsHistory_incoming_missed;

      CREATE INDEX callsHistory_incoming_missed
        ON callsHistory (callId, status, direction)
        WHERE status IS ${CALL_STATUS_MISSED}
          AND direction IS ${CALL_DIRECTION_INCOMING};
    `;
    db.exec(query);

    db.pragma('user_version = 1160');
  })();
  logger.info('updateToSchemaVersion1160: success!');
}
