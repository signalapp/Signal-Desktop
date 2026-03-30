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

describe('SQL/updateToSchemaVersion1680', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1670);
  });

  afterEach(() => {
    db.close();
  });

  it('nulls empty string columns', () => {
    insertData(db, 'conversations', [
      {
        id: 'c1',
        e164: '',
        name: '',
        profileName: '',
        profileFamilyName: '',
        expireTimerVersion: 1,
        json: {},
      },
    ]);

    updateToVersion(db, 1680);

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'c1',
        expireTimerVersion: 1,
        json: {},
      },
    ]);
  });

  it('leaves non-empty columns untouched', () => {
    insertData(db, 'conversations', [
      {
        id: 'c1',
        e164: 'abc',
        name: 'def',
        profileName: 'ghi',
        profileFamilyName: 'jkl',
        expireTimerVersion: 1,
        json: {},
      },
    ]);

    updateToVersion(db, 1680);

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'c1',
        e164: 'abc',
        name: 'def',
        profileName: 'ghi',
        profileFamilyName: 'jkl',
        expireTimerVersion: 1,
        json: {},
      },
    ]);
  });

  it('nulls empty json keys', () => {
    insertData(db, 'conversations', [
      {
        id: 'c1',
        expireTimerVersion: 1,
        json: {
          e164: '',
          name: '',
          profileName: '',
          profileFamilyName: '',
          systemGivenName: '',
          systemFamilyName: '',
          systemNickname: '',
          nicknameGivenName: null,
          nicknameFamilyName: '',
          username: '',

          // Not on the list of the affected keys
          accessKey: '',

          // Not a string
          hideStory: true,
        },
      },
    ]);

    updateToVersion(db, 1680);

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'c1',
        expireTimerVersion: 1,
        json: {
          accessKey: '',
          hideStory: true,
        },
      },
    ]);
  });
});
