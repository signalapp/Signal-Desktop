// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';

describe('SQL/updateToSchemaVersion1310', () => {
  let db: WritableDB;

  afterEach(() => {
    db.close();
  });

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1300);
  });

  it('leaves absent muteExpiresAt untouched', () => {
    const convos = [
      {
        id: 'convo',
        expireTimerVersion: 1,
        json: {},
      },
    ];
    insertData(db, 'conversations', convos);
    updateToVersion(db, 1310);

    assert.deepStrictEqual(getTableData(db, 'conversations'), convos);
  });

  it('leaves regular muteExpiresAt untouched', () => {
    const convos = [
      {
        id: 'convo',
        expireTimerVersion: 1,
        json: {
          muteExpiresAt: 123,
        },
      },
      {
        id: 'convo-2',
        expireTimerVersion: 1,
        json: {
          muteExpiresAt: 8640000000000000 - 1,
        },
      },
    ];
    insertData(db, 'conversations', convos);
    updateToVersion(db, 1310);

    assert.deepStrictEqual(getTableData(db, 'conversations'), convos);
  });

  it('promotes MAX_SAFE_DATE to MAX_SAFE_INTEGER', () => {
    insertData(db, 'conversations', [
      {
        id: 'convo',
        expireTimerVersion: 1,
        json: {
          muteExpiresAt: 8640000000000000,
        },
      },
    ]);
    updateToVersion(db, 1310);

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'convo',
        expireTimerVersion: 1,
        json: {
          muteExpiresAt: Number.MAX_SAFE_INTEGER,
        },
      },
    ]);
  });
});
