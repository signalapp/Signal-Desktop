// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import {
  dequeueOldestSyncTasks,
  removeSyncTaskById,
  saveSyncTasks,
} from '../../sql/Server';
import type { WritableDB, ReadableDB, MessageType } from '../../sql/Interface';
import { sql, jsonToObject } from '../../sql/util';
import { insertData, updateToVersion, createDB } from './helpers';
import { MAX_SYNC_TASK_ATTEMPTS } from '../../util/syncTasks.types';
import { WEEK } from '../../util/durations';

import type { MessageAttributesType } from '../../model-types';
import type { SyncTaskType } from '../../util/syncTasks';

/* eslint-disable camelcase */

// Snapshot before: 1270
export function getMostRecentAddressableMessages(
  db: ReadableDB,
  conversationId: string,
  limit = 5
): Array<MessageType> {
  const [query, parameters] = sql`
    SELECT json FROM messages
    INDEXED BY messages_by_date_addressable
    WHERE
      conversationId IS ${conversationId} AND
      isAddressableMessage = 1
    ORDER BY received_at DESC, sent_at DESC
    LIMIT ${limit};
  `;

  const rows = db.prepare(query).all(parameters);

  return rows.map(row => jsonToObject(row.json));
}

function generateMessage(json: MessageAttributesType) {
  const { conversationId, received_at, sent_at, type } = json;

  return {
    conversationId,
    json,
    received_at,
    sent_at,
    type,
  };
}

describe('SQL/updateToSchemaVersion1060', () => {
  let db: WritableDB;
  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1060);
  });

  afterEach(() => {
    db.close();
  });

  describe('Addressable Messages', () => {
    describe('Storing of new attachment jobs', () => {
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

        const messages = getMostRecentAddressableMessages(db, conversationId);

        assert.lengthOf(messages, 3);
        assert.deepEqual(messages, [
          {
            id: '6',
            conversationId,
            type: 'incoming',
            received_at: 6,
            sent_at: 6,
            timestamp: 6,
          },
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

      it('ensures that index is used for getMostRecentAddressableMessages, with storyId', () => {
        const { detail } = db
          .prepare(
            `
          EXPLAIN QUERY PLAN
          SELECT json FROM messages
          INDEXED BY messages_by_date_addressable
          WHERE
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
          'SEARCH messages USING INDEX messages_by_date_addressable (conversationId=? AND isAddressableMessage=?)'
        );
      });
    });
  });

  describe('Sync Tasks', () => {
    it('creates tasks in bulk, and fetches all', () => {
      const now = Date.now();
      const expected: Array<SyncTaskType> = [
        {
          id: generateGuid(),
          attempts: 1,
          createdAt: now + 1,
          data: {
            jsonField: 'one',
            data: 1,
          },
          envelopeId: 'envelope-id-1',
          sentAt: 1,
          type: 'delete-conversation',
        },
        {
          id: generateGuid(),
          attempts: 2,
          createdAt: now + 2,
          data: {
            jsonField: 'two',
            data: 2,
          },
          envelopeId: 'envelope-id-2',
          sentAt: 2,
          type: 'delete-conversation',
        },
        {
          id: generateGuid(),
          attempts: 3,
          createdAt: now + 3,
          data: {
            jsonField: 'three',
            data: 3,
          },
          envelopeId: 'envelope-id-3',
          sentAt: 3,
          type: 'delete-conversation',
        },
      ];

      saveSyncTasks(db, expected);

      const actual = dequeueOldestSyncTasks(db, { previousRowId: null });
      assert.deepEqual(
        expected.map(t => ({ ...t, attempts: t.attempts + 1 })),
        actual.tasks,
        'before delete'
      );

      removeSyncTaskById(db, expected[1].id);

      const actualAfterDelete = dequeueOldestSyncTasks(db, {
        previousRowId: null,
        incrementAttempts: false,
      });
      assert.deepEqual(
        [
          { ...expected[0], attempts: 2 },
          { ...expected[2], attempts: 4 },
        ],
        actualAfterDelete.tasks,
        'after delete'
      );
    });

    it('dequeueOldestSyncTasks expired tasks', () => {
      const now = Date.now();
      const twoWeeksAgo = now - WEEK * 2;
      const expected: Array<SyncTaskType> = [
        {
          id: generateGuid(),
          attempts: MAX_SYNC_TASK_ATTEMPTS,
          createdAt: twoWeeksAgo,
          data: {
            jsonField: 'expired',
            data: 1,
          },
          envelopeId: 'envelope-id-1',
          sentAt: 1,
          type: 'delete-conversation',
        },
        {
          id: generateGuid(),
          attempts: 2,
          createdAt: twoWeeksAgo,
          data: {
            jsonField: 'old-but-few-attemts',
            data: 2,
          },
          envelopeId: 'envelope-id-2',
          sentAt: 2,
          type: 'delete-conversation',
        },
        {
          id: generateGuid(),
          attempts: MAX_SYNC_TASK_ATTEMPTS * 2,
          createdAt: now,
          data: {
            jsonField: 'new-but-many-attempts',
            data: 3,
          },
          envelopeId: 'envelope-id-3',
          sentAt: 3,
          type: 'delete-conversation',
        },
        {
          id: generateGuid(),
          attempts: MAX_SYNC_TASK_ATTEMPTS - 1,
          createdAt: now + 1,
          data: {
            jsonField: 'new-and-fresh',
            data: 4,
          },
          envelopeId: 'envelope-id-4',
          sentAt: 4,
          type: 'delete-conversation',
        },
      ];

      saveSyncTasks(db, expected);

      const actual = dequeueOldestSyncTasks(db, { previousRowId: null });

      assert.lengthOf(actual.tasks, 3);
      assert.deepEqual(
        [
          { ...expected[1], attempts: 3 },
          { ...expected[2], attempts: 11 },
          { ...expected[3], attempts: 5 },
        ],
        actual.tasks
      );
    });
  });
});
