// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Database } from '@signalapp/sqlcipher';
import { sql, sqlConstant } from '../util.std.js';
import {
  CallDirection,
  CallStatusValue,
} from '../../types/CallDisposition.std.js';

const CALL_STATUS_MISSED = sqlConstant(CallStatusValue.Missed);
const CALL_DIRECTION_INCOMING = sqlConstant(CallDirection.Incoming);

export default function updateToSchemaVersion1160(db: Database): void {
  const [query] = sql`
    DROP INDEX IF EXISTS callsHistory_incoming_missed;

    CREATE INDEX callsHistory_incoming_missed
      ON callsHistory (callId, status, direction)
      WHERE status IS ${CALL_STATUS_MISSED}
        AND direction IS ${CALL_DIRECTION_INCOMING};
  `;
  db.exec(query);
}
