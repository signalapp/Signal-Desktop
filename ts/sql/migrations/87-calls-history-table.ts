// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@signalapp/better-sqlite3';

import { callIdFromEra } from '@signalapp/ringrtc';
import Long from 'long';

import type { LoggerType } from '../../types/Logging';
import { sql } from '../util';
import { getOurUuid } from './41-uuid-keys';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import {
  DirectCallStatus,
  CallDirection,
  CallType,
  GroupCallStatus,
  callHistoryDetailsSchema,
} from '../../types/CallDisposition';
import { CallMode } from '../../types/Calling';

export default function updateToSchemaVersion87(
  currentVersion: number,
  db: Database,
  logger: LoggerType
): void {
  if (currentVersion >= 87) {
    return;
  }

  db.transaction(() => {
    const ourUuid = getOurUuid(db);

    const [createTable] = sql`
      DROP TABLE IF EXISTS callsHistory;

      CREATE TABLE callsHistory (
        callId TEXT PRIMARY KEY,
        peerId TEXT NOT NULL, -- conversation uuid | groupId | roomId
        ringerId TEXT DEFAULT NULL, -- ringer uuid
        mode TEXT NOT NULL, -- enum "Direct" | "Group"
        type TEXT NOT NULL, -- enum "Audio" | "Video" | "Group"
        direction TEXT NOT NULL, -- enum "Incoming" | "Outgoing
        -- Direct: enum "Pending" | "Missed" | "Accepted" | "Deleted"
        -- Group: enum "GenericGroupCall" | "OutgoingRing" | "Ringing" | "Joined" | "Missed" | "Declined" | "Accepted" | "Deleted"
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        UNIQUE (callId, peerId) ON CONFLICT FAIL
      );

      CREATE INDEX callsHistory_order on callsHistory (timestamp DESC);
      CREATE INDEX callsHistory_byConversation ON callsHistory (peerId);
      -- For 'getCallHistoryGroupData':
      -- This index should target the subqueries for 'possible_parent' and 'possible_children'
      CREATE INDEX callsHistory_callAndGroupInfo_optimize on callsHistory (
        direction,
        peerId,
        timestamp DESC,
        status
      );
    `;

    db.exec(createTable);

    const [selectQuery] = sql`
      SELECT * FROM messages
      WHERE type = 'call-history'
      AND callId IS NOT NULL; -- Older messages don't have callId
    `;

    const rows = db.prepare(selectQuery).all();

    const uniqueConstraint = new Set();

    for (const row of rows) {
      const json = JSON.parse(row.json);
      const details = json.callHistoryDetails;

      const { conversationId: peerId } = row;
      const { callMode } = details;

      let callId: string;
      let type: CallType;
      let direction: CallDirection;
      let status: GroupCallStatus | DirectCallStatus;
      let timestamp: number;
      let ringerId: string | null = null;

      if (details.callMode === CallMode.Direct) {
        callId = details.callId;
        type = details.wasVideoCall ? CallType.Video : CallType.Audio;
        direction = details.wasIncoming
          ? CallDirection.Incoming
          : CallDirection.Outgoing;
        if (details.acceptedTime != null) {
          status = DirectCallStatus.Accepted;
        } else {
          status = details.wasDeclined
            ? DirectCallStatus.Declined
            : DirectCallStatus.Missed;
        }
        timestamp = details.endedTime ?? details.acceptedTime ?? null;
      } else if (details.callMode === CallMode.Group) {
        callId = Long.fromValue(callIdFromEra(details.eraId)).toString();
        type = CallType.Group;
        direction =
          details.creatorUuid === ourUuid
            ? CallDirection.Outgoing
            : CallDirection.Incoming;
        status = GroupCallStatus.GenericGroupCall;
        timestamp = details.startedTime;
        ringerId = details.creatorUuid;
      } else {
        logger.error(
          `updateToSchemaVersion87: unknown callMode: ${details.callMode}`
        );
        continue;
      }

      if (callId == null) {
        logger.error(
          "updateToSchemaVersion87: callId doesn't exist, too old, skipping"
        );
        continue;
      }

      const callHistory: CallHistoryDetails = {
        callId,
        peerId,
        ringerId,
        mode: callMode,
        type,
        direction,
        status,
        timestamp,
      };

      const result = callHistoryDetailsSchema.safeParse(callHistory);

      if (!result.success) {
        logger.error(
          `updateToSchemaVersion87: invalid callHistoryDetails (error: ${JSON.stringify(
            result.error.format()
          )}, input: ${JSON.stringify(json)}, output: ${JSON.stringify(
            callHistory
          )}))`
        );
        continue;
      }

      // We need to ensure a call with the same callId and peerId doesn't get
      // inserted twice because of the unique constraint on the table.
      const uniqueKey = `${callId} -> ${peerId}`;
      if (uniqueConstraint.has(uniqueKey)) {
        logger.error(
          `updateToSchemaVersion87: duplicate callId/peerId pair (${uniqueKey})`
        );
        continue;
      }
      uniqueConstraint.add(uniqueKey);

      const [insertQuery, insertParams] = sql`
        INSERT INTO callsHistory (
          callId,
          peerId,
          ringerId,
          mode,
          type,
          direction,
          status,
          timestamp
        ) VALUES (
          ${callHistory.callId},
          ${callHistory.peerId},
          ${callHistory.ringerId},
          ${callHistory.mode},
          ${callHistory.type},
          ${callHistory.direction},
          ${callHistory.status},
          ${callHistory.timestamp}
        )
      `;

      db.prepare(insertQuery).run(insertParams);

      const [updateQuery, updateParams] = sql`
        UPDATE messages
        SET json = JSON_PATCH(json, ${JSON.stringify({
          callHistoryDetails: null, // delete
          callId,
        })})
        WHERE id = ${row.id}
      `;

      db.prepare(updateQuery).run(updateParams);
    }

    const [updateMessagesTable] = sql`
      DROP INDEX IF EXISTS messages_call;

      ALTER TABLE messages
        DROP COLUMN callId;
      ALTER TABLE messages
        ADD COLUMN callId TEXT;
      ALTER TABLE messages
        DROP COLUMN callMode;
    `;

    db.exec(updateMessagesTable);

    db.pragma('user_version = 87');
  })();

  logger.info('updateToSchemaVersion87: success!');
}
