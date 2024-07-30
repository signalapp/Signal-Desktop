// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';

describe('SQL/updateToSchemaVersion990', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 980);
  });

  afterEach(() => {
    db.close();
  });

  it('should migrate conversations', () => {
    insertData(db, 'conversations', [
      {
        id: 'no-prop',
        json: {
          keep: 'this',
        },
      },
      {
        id: 'false-prop',
        json: {
          keep: 'this',
          notSharingPhoneNumber: false,
        },
      },
      {
        id: 'true-prop',
        json: {
          keep: 'this',
          notSharingPhoneNumber: true,
        },
      },
    ]);
    updateToVersion(db, 990);
    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'no-prop',
        json: {
          keep: 'this',
        },
      },
      {
        id: 'false-prop',
        json: {
          keep: 'this',
          sharingPhoneNumber: true,
        },
      },
      {
        id: 'true-prop',
        json: {
          keep: 'this',
          sharingPhoneNumber: false,
        },
      },
    ]);
  });
});
