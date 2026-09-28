// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.ts';

describe('SQL/updateToSchemaVersion1810', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1800);
  });

  afterEach(() => {
    db.close();
  });

  it('syncs the groupId column with json.groupId', () => {
    insertData(db, 'conversations', [
      {
        id: 'c1-mismatch',
        type: 'group',
        groupId: 'c1-oldid',
        expireTimerVersion: 1,
        json: { id: 'c1-mismatch', groupId: 'c1-newid' },
      },
      {
        id: 'c2-match',
        type: 'group',
        groupId: 'c2-groupId',
        expireTimerVersion: 1,
        json: { id: 'c2-match', groupId: 'c2-groupId' },
      },
      {
        id: 'c3-private',
        type: 'private',
        groupId: null,
        expireTimerVersion: 1,
        json: { id: 'c3-private' },
      },
    ]);

    updateToVersion(db, 1810);

    const groupIds = Object.fromEntries(
      getTableData(db, 'conversations').map(row => [row.id, row.groupId])
    );
    assert.deepStrictEqual(groupIds, {
      'c1-mismatch': 'c1-newid',
      'c2-match': 'c2-groupId',
      'c3-private': undefined,
    });
  });
});
