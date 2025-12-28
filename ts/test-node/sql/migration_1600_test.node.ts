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

type ConversationRow = {
  id: string;
  json: {
    username?: string;
    needsStorageServiceSync?: boolean;
  };
};
describe('SQL/updateToSchemaVersion1600', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1590);
  });
  afterEach(() => {
    db.close();
  });

  it('deduplicates usernames based on most recent active_at', () => {
    insertData(db, 'conversations', [
      {
        id: 'convo1',
        type: 'private',
        active_at: 1,
        json: {
          username: 'username1',
        },
      },
      {
        id: 'convo2',
        type: 'private',
        active_at: 2,
        json: {
          username: 'username1',
        },
      },
      {
        id: 'convo3',
        type: 'private',
        active_at: null,
        json: {
          username: 'username1',
        },
      },
      {
        id: 'convo4',
        type: 'private',
        active_at: 4,
        json: {
          username: 'username2',
        },
      },
      {
        id: 'convo5',
        type: 'private',
        active_at: 5,
        json: {
          username: 'username2',
        },
      },
      {
        id: 'convo6',
        type: 'private',
        active_at: 6,
        json: {
          username: 'username3',
        },
      },
      {
        id: 'convo7',
        type: 'private',
        active_at: 7,
        json: {},
      },
    ]);

    updateToVersion(db, 1600);

    assert.deepStrictEqual(
      (getTableData(db, 'conversations') as Array<ConversationRow>)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(({ id, json }) => ({
          id,
          username: json.username,
          needsStorageServiceSync: json.needsStorageServiceSync,
        })),
      [
        {
          id: 'convo1',
          username: undefined,
          needsStorageServiceSync: true,
        },
        {
          id: 'convo2',
          username: 'username1',
          needsStorageServiceSync: undefined,
        },
        {
          id: 'convo3',
          username: undefined,
          needsStorageServiceSync: true,
        },
        {
          id: 'convo4',
          username: undefined,
          needsStorageServiceSync: true,
        },
        {
          id: 'convo5',
          username: 'username2',
          needsStorageServiceSync: undefined,
        },
        {
          id: 'convo6',
          username: 'username3',
          needsStorageServiceSync: undefined,
        },
        {
          id: 'convo7',
          username: undefined,
          needsStorageServiceSync: undefined,
        },
      ]
    );
  });
});
