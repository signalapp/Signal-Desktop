// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface';
import { migrateConversationMessages, setupTests } from '../../sql/Server';
import { createDB, insertData, getTableData } from './helpers';

describe('SQL/migrateConversationMessages', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    setupTests(db);
  });

  afterEach(() => {
    db.close();
  });

  function compactify(
    message: Record<string, unknown>
  ): Record<string, unknown> {
    const { id, conversationId, json } = message;

    return {
      id,
      conversationId,
      json,
    };
  }

  it('should leave irrelevant messages intact', () => {
    insertData(db, 'messages', [
      {
        id: 'irrelevant',
        conversationId: 'other',
        json: {
          conversationId: 'other',
        },
      },
    ]);

    migrateConversationMessages(db, 'obsolete', 'current');

    assert.deepStrictEqual(getTableData(db, 'messages').map(compactify), [
      {
        id: 'irrelevant',
        conversationId: 'other',
        json: {
          conversationId: 'other',
        },
      },
    ]);
  });

  it('should update conversationId and send state', () => {
    insertData(db, 'messages', [
      {
        id: 'no-send-state',
        conversationId: 'obsolete',
        json: {
          conversationId: 'obsolete',
          body: 'test',
          sendStateByConversationId: {
            other: 'Failed',
            obsolete: 'Read',
          },
          editHistory: [
            {
              body: 'test2',
              sendStateByConversationId: {
                other: 'Failed',
                obsolete: 'Read',
              },
            },
          ],
        },
      },
    ]);

    migrateConversationMessages(db, 'obsolete', 'current');

    assert.deepStrictEqual(getTableData(db, 'messages').map(compactify), [
      {
        id: 'no-send-state',
        conversationId: 'current',
        json: {
          body: 'test',
          conversationId: 'current',
          sendStateByConversationId: {
            other: 'Failed',
            current: 'Read',
          },
          editHistory: [
            {
              body: 'test2',
              sendStateByConversationId: {
                other: 'Failed',
                current: 'Read',
              },
            },
          ],
        },
      },
    ]);
  });
});
