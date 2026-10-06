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

describe('SQL/updateToSchemaVersion1830', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1820);
  });

  afterEach(() => {
    db.close();
  });

  it('does nothing if there is no salt', () => {
    insertData(db, 'items', [
      /*
      {
        id: 'authCredentialSalt',
        json: { id: 'authCredentialSalt', value: '{}' },
      },
      */
    ]);

    updateToVersion(db, 1830);

    assert.deepStrictEqual(getTableData(db, 'items'), []);
  });

  it('migrates salt when possible', () => {
    insertData(db, 'items', [
      {
        id: 'authCredentialSalt',
        json: {
          id: 'authCredentialSalt',
          value: '{"type":"buffer","data":[1,2,3]}',
        },
      },
    ]);

    updateToVersion(db, 1830);

    assert.deepStrictEqual(getTableData(db, 'items'), [
      {
        id: 'authCredentialSalt',
        json: { id: 'authCredentialSalt', value: 'AQID' },
      },
    ]);
  });

  it('leaves salt unchanged when migration is not possible', () => {
    insertData(db, 'items', [
      {
        id: 'authCredentialSalt',
        json: { id: 'authCredentialSalt', value: 'abc' },
      },
    ]);

    updateToVersion(db, 1830);

    assert.deepStrictEqual(getTableData(db, 'items'), [
      {
        id: 'authCredentialSalt',
        json: { id: 'authCredentialSalt', value: 'abc' },
      },
    ]);
  });
});
