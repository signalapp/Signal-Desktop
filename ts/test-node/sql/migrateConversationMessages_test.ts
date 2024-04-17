// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { Database } from '@signalapp/better-sqlite3';
import SQL from '@signalapp/better-sqlite3';

import data, { setupTests, teardownTests } from '../../sql/Server';
import { insertData, getTableData } from './helpers';

describe('SQL/migrateConversationMessages', () => {
  let db: Database;

  beforeEach(() => {
    db = new SQL(':memory:');
    setupTests(db);
  });

  afterEach(() => {
    db.close();
    teardownTests();
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

  it('should leave irrelevant messages intact', async () => {
    insertData(db, 'messages', [
      {
        id: 'irrelevant',
        conversationId: 'other',
        json: {
          conversationId: 'other',
        },
      },
    ]);

    await data.migrateConversationMessages('obsolete', 'current');

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

  it('should update conversationId and send state', async () => {
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

    await data.migrateConversationMessages('obsolete', 'current');

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
