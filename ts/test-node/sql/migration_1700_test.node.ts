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

describe('SQL/updateToSchemaVersion1700', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1690);
  });

  afterEach(() => {
    db.close();
  });

  it('trims profile name columns and nulls empty results', () => {
    insertData(db, 'conversations', [
      {
        id: 'c1',
        profileName: '  Alice  ',
        expireTimerVersion: 1,
        json: {
          profileName: '  Alice  ',
          profileFamilyName: '   ',
          systemName: 'System ',
          systemFamilyName: 'Name',
        },
      },
      {
        id: 'c2',
        profileName: 'Alice',
        profileFamilyName: 'LastName ',
        expireTimerVersion: 1,
        json: {
          profileName: '  Alice  ',
          profileFamilyName: 'LastName ',
          systemName: 'System ',
          systemFamilyName: 'Name',
        },
      },
    ]);

    updateToVersion(db, 1700);

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'c1',
        profileName: 'Alice',
        expireTimerVersion: 1,
        json: {
          profileName: 'Alice',
          systemName: 'System ',
          systemFamilyName: 'Name',
        },
      },
      {
        id: 'c2',
        profileName: 'Alice',
        profileFamilyName: 'LastName',
        expireTimerVersion: 1,
        json: {
          profileName: 'Alice',
          profileFamilyName: 'LastName',
          systemName: 'System ',
          systemFamilyName: 'Name',
        },
      },
    ]);
  });
});
