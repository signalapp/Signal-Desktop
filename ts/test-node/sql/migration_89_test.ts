// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import { jsonToObject, sql } from '../../sql/util';
import {
  CallMode,
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
  callHistoryDetailsSchema,
} from '../../types/CallDisposition';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import type {
  CallHistoryDetailsFromDiskType,
  MessageWithCallHistoryDetails,
} from '../../sql/migrations/89-call-history';
import { getCallIdFromEra } from '../../util/callDisposition';
import { isValidUuid } from '../../util/isValidUuid';
import { createDB, updateToVersion } from './helpers';
import type { WritableDB, MessageType } from '../../sql/Interface';
import { parsePartial } from '../../util/schemas';

describe('SQL/updateToSchemaVersion89', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 88);
  });

  afterEach(() => {
    db.close();
  });

  function getDirectCallHistoryDetails(options: {
    callId: string | null;
    noCallMode?: boolean;
    wasDeclined?: boolean;
    noTimestamps?: boolean;
  }): CallHistoryDetailsFromDiskType {
    return {
      callId: options.callId ?? undefined,
      callMode: options.noCallMode ? undefined : CallMode.Direct,
      wasDeclined: options.wasDeclined ?? false,
      wasIncoming: false,
      wasVideoCall: false,
      acceptedTime: undefined,
      endedTime: undefined,
    };
  }

  function getGroupCallHistoryDetails(options: {
    eraId: string;
    noCallMode?: boolean;
    noTimestamps?: boolean;
  }): CallHistoryDetailsFromDiskType {
    return {
      eraId: options.eraId,
      callMode: options.noCallMode ? undefined : CallMode.Group,
      creatorUuid: generateGuid(),
      startedTime: options.noTimestamps ? undefined : Date.now(),
    };
  }

  type Timestamps = Pick<
    MessageWithCallHistoryDetails,
    'sent_at' | 'received_at_ms' | 'timestamp'
  >;

  function createCallHistoryMessage(options: {
    messageId: string;
    conversationId: string;
    callHistoryDetails: CallHistoryDetailsFromDiskType;
    timestamps?: Partial<Timestamps>;
  }): MessageWithCallHistoryDetails {
    // @ts-expect-error Purposefully violating the type to test the migration
    const timestamps: Timestamps = options.timestamps
      ? options.timestamps
      : {
          sent_at: Date.now(),
          received_at_ms: Date.now(),
          timestamp: Date.now(),
        };

    const message: MessageWithCallHistoryDetails = {
      id: options.messageId,
      type: 'call-history',
      conversationId: options.conversationId,
      received_at: Date.now(),
      ...timestamps,
      callHistoryDetails: options.callHistoryDetails,
    };

    const json = JSON.stringify(message);

    const [query, params] = sql`
      INSERT INTO messages
        (id, conversationId, type, json)
      VALUES
        (
          ${message.id},
          ${message.conversationId},
          ${message.type},
          ${json}
        )
    `;

    db.prepare(query).run(params);

    return message;
  }

  function createConversation(
    type: 'private' | 'group',
    discoveredUnregisteredAt?: number
  ) {
    const id = generateGuid();
    const serviceId =
      // Emulate older unregistered conversations
      type === 'private' && discoveredUnregisteredAt == null
        ? generateGuid()
        : null;
    const groupId = type === 'group' ? generateGuid() : null;

    const json = JSON.stringify({
      type,
      id,
      serviceId,
      groupId,
      discoveredUnregisteredAt,
    });

    const [query, params] = sql`
      INSERT INTO conversations
        (id, type, serviceId, groupId, json)
      VALUES
        (${id}, ${type}, ${serviceId}, ${groupId}, ${json});
    `;

    db.prepare(query).run(params);

    return { id, serviceId, groupId };
  }

  function getAllCallHistory() {
    const [selectHistoryQuery] = sql`
      SELECT * FROM callsHistory;
    `;
    return db
      .prepare(selectHistoryQuery)
      .all()
      .map((row: object) => {
        return parsePartial(callHistoryDetailsSchema, {
          ...row,

          // Not present at the time of migration, but required by zod
          startedById: null,
          endedTimestamp: null,
        });
      });
  }

  it('pulls out call history messages into the new table', () => {
    updateToVersion(db, 88);

    const conversation1 = createConversation('private');
    const conversation2 = createConversation('group');

    const callId1 = '123';
    const eraId2 = 'abc';

    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation1.id,
      callHistoryDetails: getDirectCallHistoryDetails({
        callId: callId1,
      }),
    });

    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation2.id,
      callHistoryDetails: getGroupCallHistoryDetails({
        eraId: eraId2,
      }),
    });

    updateToVersion(db, 89);

    const callHistory = getAllCallHistory();

    assert.strictEqual(callHistory.length, 2);
    assert.strictEqual(callHistory[0].callId, callId1);
    assert.strictEqual(callHistory[1].callId, getCallIdFromEra(eraId2));
  });

  it('migrates older messages without a callId', () => {
    updateToVersion(db, 88);

    const conversation = createConversation('private');
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation.id,
      callHistoryDetails: getDirectCallHistoryDetails({
        callId: null, // no id
      }),
    });

    updateToVersion(db, 89);

    const callHistory = getAllCallHistory();

    assert.strictEqual(callHistory.length, 1);
    assert.isTrue(isValidUuid(callHistory[0].callId));
  });

  it('migrates older messages without a callMode', () => {
    updateToVersion(db, 88);

    const conversation1 = createConversation('private');
    const conversation2 = createConversation('group');
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation1.id,
      callHistoryDetails: getDirectCallHistoryDetails({
        callId: null, // no id
        noCallMode: true,
      }),
    });
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation2.id,
      callHistoryDetails: getGroupCallHistoryDetails({
        eraId: 'abc',
        noCallMode: true,
      }),
    });

    updateToVersion(db, 89);

    const callHistory = getAllCallHistory();

    assert.strictEqual(callHistory.length, 2);
    assert.strictEqual(callHistory[0].mode, CallMode.Direct);
    assert.strictEqual(callHistory[1].mode, CallMode.Group);
  });

  it('handles unique constraint violations', () => {
    updateToVersion(db, 88);

    const conversation = createConversation('private');
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation.id, // same conversation
      callHistoryDetails: getDirectCallHistoryDetails({
        callId: '123', // same callId
      }),
    });
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation.id, // same conversation
      callHistoryDetails: getDirectCallHistoryDetails({
        callId: '123', // same callId
      }),
    });

    updateToVersion(db, 89);

    const callHistory = getAllCallHistory();
    assert.strictEqual(callHistory.length, 1);
  });

  it('normalizes peerId to conversation.serviceId or conversation.groupId', () => {
    updateToVersion(db, 88);

    const conversation1 = createConversation('private');
    const conversation2 = createConversation('group');
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation1.id,
      callHistoryDetails: getDirectCallHistoryDetails({
        callId: '123',
      }),
    });
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation2.id,
      callHistoryDetails: getGroupCallHistoryDetails({
        eraId: 'abc',
      }),
    });

    updateToVersion(db, 89);

    const callHistory = getAllCallHistory();
    assert.strictEqual(callHistory.length, 2);
    assert.strictEqual(callHistory[0].peerId, conversation1.serviceId);
    assert.strictEqual(callHistory[1].peerId, conversation2.groupId);
  });

  it('migrates older unregistered conversations with no serviceId', () => {
    updateToVersion(db, 88);

    const conversation = createConversation('private', Date.now());
    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation.id,
      callHistoryDetails: getDirectCallHistoryDetails({
        callId: '123',
      }),
    });

    updateToVersion(db, 89);

    const callHistory = getAllCallHistory();
    assert.strictEqual(callHistory.length, 1);
    assert.strictEqual(callHistory[0].peerId, conversation.id);
  });

  it('migrates call-history messages with no timestamp', () => {
    updateToVersion(db, 88);

    const conversation = createConversation('private', Date.now());

    const timestampCases = {
      noTimestamps: {
        sent_at: undefined,
        received_at_ms: undefined,
        timestamp: undefined,
      },
      onlyTimestamp: {
        sent_at: undefined,
        received_at_ms: undefined,
        timestamp: 1,
      },
      onlySentAt: {
        sent_at: 2,
        received_at_ms: undefined,
        timestamp: undefined,
      },
      onlyReceivedAt: {
        sent_at: undefined,
        received_at_ms: 3,
        timestamp: undefined,
      },
    } satisfies Record<string, Partial<Timestamps>>;

    for (const [id, timestamps] of Object.entries(timestampCases)) {
      createCallHistoryMessage({
        messageId: generateGuid(),
        conversationId: conversation.id,
        callHistoryDetails: getDirectCallHistoryDetails({
          callId: id,
          noTimestamps: true,
        }),
        timestamps,
      });
      createCallHistoryMessage({
        messageId: generateGuid(),
        conversationId: conversation.id,
        callHistoryDetails: getGroupCallHistoryDetails({
          eraId: id,
          noTimestamps: true,
        }),
        timestamps,
      });
    }

    updateToVersion(db, 89);

    const callHistory = getAllCallHistory();
    assert.strictEqual(callHistory.length, 8);
    assert.strictEqual(callHistory[0].timestamp, 0);
    assert.strictEqual(callHistory[1].timestamp, 0);
    assert.strictEqual(callHistory[2].timestamp, 1);
    assert.strictEqual(callHistory[3].timestamp, 1);
    assert.strictEqual(callHistory[4].timestamp, 2);
    assert.strictEqual(callHistory[5].timestamp, 2);
    assert.strictEqual(callHistory[6].timestamp, 3);
    assert.strictEqual(callHistory[7].timestamp, 3);
  });

  describe('clients with schema version 87', () => {
    function createCallHistoryTable() {
      const [query] = sql`
        CREATE TABLE callsHistory (
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
      `;
      db.exec(query);
    }

    function insertCallHistory(callHistory: CallHistoryDetails) {
      const [query, params] = sql`
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
        );
      `;
      db.prepare(query).run(params);
    }

    function getMessages() {
      const [query] = sql`
        SELECT json FROM messages;
      `;
      return db
        .prepare(query)
        .all()
        .map(row => {
          return jsonToObject<MessageType>(row.json);
        });
    }

    it('migrates existing peerId to conversation.serviceId or conversation.groupId', () => {
      updateToVersion(db, 88);

      createCallHistoryTable();

      const conversation1 = createConversation('private');
      const conversation2 = createConversation('group');

      insertCallHistory({
        callId: '123',
        peerId: conversation1.id,
        ringerId: null,
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Accepted,
        timestamp: Date.now(),

        // Not present at the time of migration
        startedById: null,
        endedTimestamp: null,
      });
      insertCallHistory({
        callId: 'abc',
        peerId: conversation2.id,
        ringerId: null,
        mode: CallMode.Group,
        type: CallType.Group,
        direction: CallDirection.Incoming,
        status: GroupCallStatus.Accepted,
        timestamp: Date.now(),

        // Not present at the time of migration
        startedById: null,
        endedTimestamp: null,
      });

      updateToVersion(db, 89);

      const callHistory = getAllCallHistory();
      assert.strictEqual(callHistory.length, 2);
      assert.strictEqual(callHistory[0].peerId, conversation1.serviceId);
      assert.strictEqual(callHistory[1].peerId, conversation2.groupId);
    });

    it('migrates duplicate call history where the first was already migrated', () => {
      updateToVersion(db, 88);

      createCallHistoryTable();

      const conversation = createConversation('private');

      insertCallHistory({
        callId: '123',
        peerId: conversation.id,
        ringerId: null,
        mode: CallMode.Direct,
        type: CallType.Audio,
        direction: CallDirection.Incoming,
        status: DirectCallStatus.Pending,
        timestamp: Date.now() - 1000,

        // Not present at the time of migration
        startedById: null,
        endedTimestamp: null,
      });

      createCallHistoryMessage({
        messageId: generateGuid(),
        conversationId: conversation.id,
        callHistoryDetails: getDirectCallHistoryDetails({
          callId: '123',
          wasDeclined: true,
        }),
      });

      updateToVersion(db, 89);

      const callHistory = getAllCallHistory();

      assert.strictEqual(callHistory.length, 1);
      assert.strictEqual(callHistory[0].status, DirectCallStatus.Declined);

      const messages = getMessages();
      assert.strictEqual(messages.length, 1);
      assert.strictEqual(messages[0].type, 'call-history');
      assert.strictEqual(messages[0].callId, '123');
      assert.notProperty(messages[0], 'callHistoryDetails');
    });
  });
});
