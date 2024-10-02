// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { callIdFromEra } from '@signalapp/ringrtc';
import Long from 'long';
import { v4 as generateUuid } from 'uuid';
import { isObject } from 'lodash';

import type { SetOptional } from 'type-fest';
import type { LoggerType } from '../../types/Logging';
import { jsonToObject, sql } from '../util';
import { getOurUuid } from './41-uuid-keys';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import {
  DirectCallStatus,
  CallDirection,
  CallType,
  GroupCallStatus,
  callHistoryDetailsSchema,
  CallMode,
} from '../../types/CallDisposition';
import type { WritableDB, MessageType, ConversationType } from '../Interface';
import { strictAssert } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { isAciString } from '../../util/isAciString';
import { safeParseStrict } from '../../util/schemas';

// Legacy type for calls that never had a call id
type DirectCallHistoryDetailsType = {
  callId?: string;
  callMode: CallMode.Direct;
  wasIncoming: boolean;
  wasVideoCall: boolean;
  wasDeclined: boolean;
  acceptedTime?: number;
  endedTime?: number;
};
type GroupCallHistoryDetailsType = {
  callMode: CallMode.Group;
  creatorUuid: string;
  eraId: string;
  startedTime?: number; // Treat this as optional, some calls may be missing it
};
export type CallHistoryDetailsType =
  | DirectCallHistoryDetailsType
  | GroupCallHistoryDetailsType;

export type CallHistoryDetailsFromDiskType =
  // old messages weren't set with a callMode
  | SetOptional<DirectCallHistoryDetailsType, 'callMode'>
  | SetOptional<GroupCallHistoryDetailsType, 'callMode'>;

export type MessageWithCallHistoryDetails = MessageType & {
  callHistoryDetails: CallHistoryDetailsFromDiskType;
};

function upcastCallHistoryDetailsFromDiskType(
  callDetails: CallHistoryDetailsFromDiskType
): CallHistoryDetailsType {
  if (callDetails.callMode === CallMode.Direct) {
    return callDetails as DirectCallHistoryDetailsType;
  }
  if (callDetails.callMode === CallMode.Group) {
    return callDetails as GroupCallHistoryDetailsType;
  }
  // Some very old calls don't have a callMode, so we need to infer it from the
  // other fields. This is a best effort attempt to make sure we at least have
  // enough data to form the call history entry correctly.
  if (
    Object.hasOwn(callDetails, 'wasIncoming') &&
    Object.hasOwn(callDetails, 'wasVideoCall')
  ) {
    return {
      callMode: CallMode.Direct,
      ...callDetails,
    } as DirectCallHistoryDetailsType;
  }
  if (
    Object.hasOwn(callDetails, 'eraId') &&
    Object.hasOwn(callDetails, 'startedTime')
  ) {
    return {
      callMode: CallMode.Group,
      ...callDetails,
    } as GroupCallHistoryDetailsType;
  }
  throw new Error('Could not determine call mode');
}

function getPeerIdFromConversation(
  conversation: ConversationType,
  logger: LoggerType
): string {
  if (conversation.type === 'private') {
    if (conversation.serviceId == null) {
      logger.warn(
        `updateToSchemaVersion89: Private conversation (${conversation.id}) was missing serviceId (discoveredUnregisteredAt: ${conversation.discoveredUnregisteredAt})`
      );
      return conversation.id;
    }
    strictAssert(
      isAciString(conversation.serviceId),
      'ACI must exist for direct chat'
    );
    return conversation.serviceId;
  }
  strictAssert(
    conversation.groupId != null,
    'groupId must exist for group chat'
  );
  return conversation.groupId;
}

function convertLegacyCallDetails(
  ourUuid: string | undefined,
  peerId: string,
  message: MessageType,
  partialDetails: CallHistoryDetailsFromDiskType,
  logger: LoggerType
): CallHistoryDetails {
  const details = upcastCallHistoryDetailsFromDiskType(partialDetails);
  const { callMode: mode } = details;

  let callId: string;
  let type: CallType;
  let direction: CallDirection;
  let status: GroupCallStatus | DirectCallStatus;
  let timestamp: number;
  let ringerId: string | null = null;

  strictAssert(mode != null, 'mode must exist');

  // If we cannot find any timestamp on the message, we'll use 0
  const fallbackTimestamp =
    message.timestamp ?? message.sent_at ?? message.received_at_ms ?? 0;

  if (mode === CallMode.Direct) {
    // We don't have a callId for older calls, generating a uuid instead
    callId = details.callId ?? generateUuid();
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
    timestamp = details.acceptedTime ?? details.endedTime ?? fallbackTimestamp;
  } else if (mode === CallMode.Group) {
    callId = Long.fromValue(callIdFromEra(details.eraId)).toString();
    type = CallType.Group;
    direction =
      details.creatorUuid === ourUuid
        ? CallDirection.Outgoing
        : CallDirection.Incoming;
    status = GroupCallStatus.GenericGroupCall;
    timestamp = details.startedTime ?? fallbackTimestamp;
    ringerId = details.creatorUuid;
  } else {
    throw missingCaseError(mode);
  }

  const callHistory: CallHistoryDetails = {
    callId,
    peerId,
    ringerId,
    mode,
    type,
    direction,
    status,
    timestamp,

    // Not present at the time of this migration
    startedById: null,
    endedTimestamp: null,
  };

  const result = safeParseStrict(callHistoryDetailsSchema, callHistory);
  if (result.success) {
    return result.data;
  }

  logger.error(
    `convertLegacyCallDetails: Could not convert ${mode} call`,
    result.error.toString()
  );
  throw new Error(`Failed to convert legacy ${mode} call details`);
}

export default function updateToSchemaVersion89(
  currentVersion: number,
  db: WritableDB,
  logger: LoggerType
): void {
  if (currentVersion >= 89) {
    return;
  }

  db.transaction(() => {
    const ourUuid = getOurUuid(db);

    const [createTable] = sql`
      -- This table may have already existed from migration 87
      CREATE TABLE IF NOT EXISTS callsHistory (
        callId TEXT PRIMARY KEY,
        peerId TEXT NOT NULL, -- conversation id (legacy) | uuid | groupId | roomId
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

      -- Update peerId to be uuid or groupId
      UPDATE callsHistory
        SET peerId = (
          SELECT
            CASE
              WHEN conversations.type = 'private' THEN conversations.serviceId
              WHEN conversations.type = 'group' THEN conversations.groupId
            END
          FROM conversations
          WHERE callsHistory.peerId IS conversations.id
            AND callsHistory.peerId IS NOT conversations.serviceId
        )
        WHERE EXISTS (
          SELECT 1
          FROM conversations
          WHERE callsHistory.peerId IS conversations.id
            AND callsHistory.peerId IS NOT conversations.serviceId
        );

      CREATE INDEX IF NOT EXISTS callsHistory_order on callsHistory (timestamp DESC);
      CREATE INDEX IF NOT EXISTS callsHistory_byConversation ON callsHistory (peerId);
      -- For 'getCallHistoryGroupData':
      -- This index should target the subqueries for 'possible_parent' and 'possible_children'
      CREATE INDEX IF NOT EXISTS callsHistory_callAndGroupInfo_optimize on callsHistory (
        direction,
        peerId,
        timestamp DESC,
        status
      );
    `;

    db.exec(createTable);

    const [selectQuery] = sql`
      SELECT
        messages.json AS messageJson,
        conversations.id AS conversationId,
        conversations.json AS conversationJson
      FROM messages
      LEFT JOIN conversations ON conversations.id = messages.conversationId
      WHERE messages.type = 'call-history'
      -- Some of these messages were already migrated
      AND messages.json->'callHistoryDetails' IS NOT NULL
      -- Sort from oldest to newest, so that newer messages can overwrite older
      ORDER BY messages.received_at ASC, messages.sent_at ASC;
    `;

    // Must match query above
    type CallHistoryRow = {
      messageJson: string;
      conversationId: string;
      conversationJson: string;
    };

    const rows: Array<CallHistoryRow> = db.prepare(selectQuery).all();

    for (const row of rows) {
      const { messageJson, conversationId, conversationJson } = row;
      const message = jsonToObject<MessageWithCallHistoryDetails>(messageJson);
      const conversation = jsonToObject<ConversationType>(conversationJson);

      if (!isObject(conversation)) {
        logger.warn(
          `updateToSchemaVersion89: Private conversation (${conversationId}) ` +
            'has non-object json column'
        );
        continue;
      }

      const details = message.callHistoryDetails;

      const peerId = getPeerIdFromConversation(conversation, logger);

      const callHistory = convertLegacyCallDetails(
        ourUuid,
        peerId,
        message,
        details,
        logger
      );

      const [insertQuery, insertParams] = sql`
        -- Using 'OR REPLACE' because in some earlier versions of call history
        -- we had a bug where we would insert duplicate call history entries
        -- for the same callId and peerId.
        -- We're assuming here that the latest call history entry is the most
        -- accurate.
        INSERT OR REPLACE INTO callsHistory (
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

      const messageId = message.id;
      strictAssert(messageId != null, 'message.id must exist');

      const [updateQuery, updateParams] = sql`
        UPDATE messages
        SET json = JSON_PATCH(json, ${JSON.stringify({
          callHistoryDetails: null, // delete
          callId: callHistory.callId,
        })})
        WHERE id = ${messageId}
      `;

      db.prepare(updateQuery).run(updateParams);
    }

    const [dropIndex] = sql`
      DROP INDEX IF EXISTS messages_call;
    `;
    db.exec(dropIndex);

    try {
      const [dropColumnQuery] = sql`
        ALTER TABLE messages
          DROP COLUMN callMode;
      `;
      db.exec(dropColumnQuery);
    } catch (error) {
      if (!error.message.includes('no such column: "callMode"')) {
        throw error;
      }
    }

    try {
      const [dropColumnQuery] = sql`
        ALTER TABLE messages
          DROP COLUMN callId;
      `;
      db.exec(dropColumnQuery);
    } catch (error) {
      if (!error.message.includes('no such column: "callId"')) {
        throw error;
      }
    }

    const [optimizeMessages] = sql`
      ALTER TABLE messages
        ADD COLUMN callId TEXT
        GENERATED ALWAYS AS (
          json_extract(json, '$.callId')
        );
      -- Optimize getCallHistoryMessageByCallId
      CREATE INDEX messages_call ON messages
        (conversationId, type, callId);

      CREATE INDEX messages_callHistory_readStatus ON messages
        (type, readStatus)
        WHERE type IS 'call-history';
    `;
    db.exec(optimizeMessages);

    db.pragma('user_version = 89');
  })();

  logger.info('updateToSchemaVersion89: success!');
}
