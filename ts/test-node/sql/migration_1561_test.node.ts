// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface.std.js';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.js';

describe('SQL/updateToSchemaVersion1561', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1560);
  });
  afterEach(() => {
    db.close();
  });

  it('removes json.poll and hasUnreadPollVotes', () => {
    insertData(db, 'messages', [
      {
        id: 'message-id',
        isErased: 0,
        json: {
          id: 'message-id',
          poll: {
            question: 'poll question',
          },
        },
        hasUnreadPollVotes: 1,
      },
      {
        id: 'message-id-2',
        isErased: 1,
        json: {
          id: 'message-id-2',
          poll: {
            question: 'poll question',
          },
        },
        hasUnreadPollVotes: 1,
      },
    ]);
    updateToVersion(db, 1561);
    assert.deepStrictEqual(
      getTableData(db, 'messages').map(row => ({
        id: row.id,
        json: row.json,
        isErased: row.isErased,
        hasUnreadPollVotes: row.hasUnreadPollVotes,
      })),
      [
        {
          id: 'message-id',
          isErased: 0,
          json: {
            id: 'message-id',
            poll: {
              question: 'poll question',
            },
          },
          hasUnreadPollVotes: 1,
        },
        {
          id: 'message-id-2',
          isErased: 1,
          json: {
            id: 'message-id-2',
          },
          hasUnreadPollVotes: 0,
        },
      ]
    );
  });
});
