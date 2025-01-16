// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import type { WritableDB, ReadableDB, MessageType } from '../../sql/Interface';
import { sql, jsonToObject } from '../../sql/util';
import { createDB, insertData, updateToVersion } from './helpers';

import type { MessageAttributesType } from '../../model-types';
import { DurationInSeconds } from '../../util/durations/duration-in-seconds';

/* eslint-disable camelcase */

function generateMessage(json: MessageAttributesType) {
  const { conversationId, expireTimer, received_at, sent_at, type } = json;

  return {
    conversationId,
    json,
    received_at,
    sent_at,
    expireTimer: Number(expireTimer),
    type,
  };
}

// Snapshot before: 1270
export function getMostRecentAddressableNondisappearingMessages(
  db: ReadableDB,
  conversationId: string,
  limit = 5
): Array<MessageType> {
  const [query, parameters] = sql`
    SELECT json FROM messages
    INDEXED BY messages_by_date_addressable_nondisappearing
    WHERE
      expireTimer IS NULL AND
      conversationId IS ${conversationId} AND
      isAddressableMessage = 1
    ORDER BY received_at DESC, sent_at DESC
    LIMIT ${limit};
  `;

  const rows = db.prepare(query).all(parameters);

  return rows.map(row => jsonToObject(row.json));
}

describe('SQL/updateToSchemaVersion1080', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1080);
  });

  afterEach(() => {
    db.close();
  });

  describe('Addressable Messages', () => {
    it('returns only incoming/outgoing messages', () => {
      const conversationId = generateGuid();
      const otherConversationId = generateGuid();

      insertData(db, 'messages', [
        generateMessage({
          id: '1',
          conversationId,
          type: 'incoming',
          received_at: 1,
          sent_at: 1,
          timestamp: 1,
        }),
        generateMessage({
          id: '2',
          conversationId,
          type: 'story',
          received_at: 2,
          sent_at: 2,
          timestamp: 2,
        }),
        generateMessage({
          id: '3',
          conversationId,
          type: 'outgoing',
          received_at: 3,
          sent_at: 3,
          timestamp: 3,
        }),
        generateMessage({
          id: '4',
          conversationId,
          type: 'group-v1-migration',
          received_at: 4,
          sent_at: 4,
          timestamp: 4,
        }),
        generateMessage({
          id: '5',
          conversationId,
          type: 'group-v2-change',
          received_at: 5,
          sent_at: 5,
          timestamp: 5,
        }),
        generateMessage({
          id: '6',
          conversationId,
          type: 'incoming',
          received_at: 6,
          sent_at: 6,
          timestamp: 6,
          expireTimer: DurationInSeconds.fromMinutes(10),
        }),
        generateMessage({
          id: '7',
          conversationId,
          type: 'profile-change',
          received_at: 7,
          sent_at: 7,
          timestamp: 7,
        }),
        generateMessage({
          id: '8',
          conversationId: otherConversationId,
          type: 'incoming',
          received_at: 8,
          sent_at: 8,
          timestamp: 8,
        }),
      ]);

      const messages = getMostRecentAddressableNondisappearingMessages(
        db,
        conversationId
      );

      assert.lengthOf(messages, 2);
      assert.deepEqual(messages, [
        {
          id: '3',
          conversationId,
          type: 'outgoing',
          received_at: 3,
          sent_at: 3,
          timestamp: 3,
        },
        {
          id: '1',
          conversationId,
          type: 'incoming',
          received_at: 1,
          sent_at: 1,
          timestamp: 1,
        },
      ]);
    });

    it('ensures that index is used for getMostRecentAddressableNondisappearingMessagesSync, with storyId', () => {
      const { detail } = db
        .prepare(
          `
          EXPLAIN QUERY PLAN
          SELECT json FROM messages
          INDEXED BY messages_by_date_addressable_nondisappearing
          WHERE
            expireTimer IS NULL AND
            conversationId IS 'not-important' AND
            isAddressableMessage = 1
          ORDER BY received_at DESC, sent_at DESC
          LIMIT 5;
          `
        )
        .get();

      assert.notInclude(detail, 'B-TREE');
      assert.notInclude(detail, 'SCAN');
      assert.include(
        detail,
        'SEARCH messages USING INDEX messages_by_date_addressable_nondisappearing (conversationId=? AND isAddressableMessage=?)'
      );
    });
  });
});
