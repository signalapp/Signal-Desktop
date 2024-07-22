// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import { jsonToObject, sql } from '../../sql/util';
import { createDB, updateToVersion } from './helpers';
import type { WritableDB, MessageType } from '../../sql/Interface';
import { ReadStatus } from '../../messages/MessageReadStatus';
import { SeenStatus } from '../../MessageSeenStatus';

describe('SQL/updateToSchemaVersion1000', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 990);
  });

  afterEach(() => {
    db.close();
  });

  function createCallHistoryMessage(options: {
    messageId: string;
    conversationId: string;
    callId: string;
    readStatus: ReadStatus;
    seenStatus: SeenStatus;
  }): MessageType {
    const message: MessageType = {
      id: options.messageId,
      type: 'call-history',
      conversationId: options.conversationId,
      received_at: Date.now(),
      sent_at: Date.now(),
      received_at_ms: Date.now(),
      timestamp: Date.now(),
      readStatus: options.readStatus,
      seenStatus: options.seenStatus,
      callId: options.callId,
    };

    const json = JSON.stringify(message);

    const [query, params] = sql`
      INSERT INTO messages
        (id, conversationId, type, readStatus, seenStatus, json)
      VALUES
        (
          ${message.id},
          ${message.conversationId},
          ${message.type},
          ${message.readStatus},
          ${message.seenStatus},
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
    const groupId = type === 'group' ? generateGuid() : null;

    const json = JSON.stringify({
      type,
      id,
      groupId,
      discoveredUnregisteredAt,
    });

    const [query, params] = sql`
      INSERT INTO conversations
        (id, type, groupId, json)
      VALUES
        (${id}, ${type}, ${groupId}, ${json});
    `;

    db.prepare(query).run(params);

    return { id, groupId };
  }

  function getMessages() {
    const [query] = sql`
      SELECT json, readStatus, seenStatus FROM messages;
    `;
    return db
      .prepare(query)
      .all()
      .map(row => {
        return {
          message: jsonToObject<MessageType>(row.json),
          readStatus: row.readStatus,
          seenStatus: row.seenStatus,
        };
      });
  }

  it('marks unread call history messages read and unseen', () => {
    const conversation1 = createConversation('private');
    const conversation2 = createConversation('group');

    const callId1 = '1';
    const callId2 = '2';

    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation1.id,
      callId: callId1,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
    });

    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation2.id,
      callId: callId2,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
    });

    updateToVersion(db, 1000);

    const messages = getMessages();

    assert.strictEqual(messages.length, 2);

    assert.strictEqual(messages[0].message.readStatus, ReadStatus.Read);
    assert.strictEqual(messages[0].message.seenStatus, SeenStatus.Unseen);
    assert.strictEqual(messages[0].readStatus, ReadStatus.Read);
    assert.strictEqual(messages[0].seenStatus, SeenStatus.Unseen);

    assert.strictEqual(messages[1].message.readStatus, ReadStatus.Read);
    assert.strictEqual(messages[1].message.seenStatus, SeenStatus.Unseen);
    assert.strictEqual(messages[1].readStatus, ReadStatus.Read);
    assert.strictEqual(messages[1].seenStatus, SeenStatus.Unseen);
  });

  it('does not mark read call history messages as unseen', () => {
    const conversation1 = createConversation('private');
    const conversation2 = createConversation('group');

    const callId1 = '1';
    const callId2 = '2';

    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation1.id,
      callId: callId1,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Seen,
    });

    createCallHistoryMessage({
      messageId: generateGuid(),
      conversationId: conversation2.id,
      callId: callId2,
      readStatus: ReadStatus.Read,
      seenStatus: SeenStatus.Seen,
    });

    updateToVersion(db, 1000);

    const messages = getMessages();

    assert.strictEqual(messages.length, 2);

    assert.strictEqual(messages[0].message.readStatus, ReadStatus.Read);
    assert.strictEqual(messages[0].message.seenStatus, SeenStatus.Seen);
    assert.strictEqual(messages[0].readStatus, ReadStatus.Read);
    assert.strictEqual(messages[0].seenStatus, SeenStatus.Seen);

    assert.strictEqual(messages[1].message.readStatus, ReadStatus.Read);
    assert.strictEqual(messages[1].message.seenStatus, SeenStatus.Seen);
    assert.strictEqual(messages[1].readStatus, ReadStatus.Read);
    assert.strictEqual(messages[1].seenStatus, SeenStatus.Seen);
  });
});
