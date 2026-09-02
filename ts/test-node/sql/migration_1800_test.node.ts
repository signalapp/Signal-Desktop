// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { sortBy } from 'lodash';

import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createDB,
  updateToVersion,
  insertData,
  getTableData,
} from './helpers.node.ts';
import { getRandomBytes } from '../../Crypto.node.ts';

describe('SQL/updateToSchemaVersion1800', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
  });

  afterEach(() => {
    db.close();
  });

  it('adds and sets addedAt, sets storageNeedsSync, deletes if missing both adminKey and storageId', () => {
    updateToVersion(db, 1790);
    const initialData = [
      {
        roomId: 'roomId1 (to be deleted)',
        rootKey: Buffer.from(getRandomBytes(32)),
        adminKey: null,
        storageID: null,
        storageVersion: null,
        storageUnknownFields: null,
        storageNeedsSync: 0,
      },
      {
        roomId: 'roomId2',
        rootKey: Buffer.from(getRandomBytes(32)),
        adminKey: Buffer.from(getRandomBytes(32)),
        storageID: null,
        storageVersion: null,
        storageUnknownFields: null,
        storageNeedsSync: 0,
      },
      {
        roomId: 'roomId3',
        rootKey: Buffer.from(getRandomBytes(32)),
        adminKey: Buffer.from(getRandomBytes(32)),
        storageID: 'storageId3',
        storageVersion: 3,
        storageUnknownFields: Buffer.from(getRandomBytes(32)),
        storageNeedsSync: 0,
      },
      {
        roomId: 'roomId4',
        rootKey: Buffer.from(getRandomBytes(32)),
        adminKey: null,
        storageID: 'storageId4',
        storageVersion: 4,
        storageUnknownFields: null,
        storageNeedsSync: 0,
      },
    ];
    insertData(db, 'defunctCallLinks', initialData);

    const now = Date.now();
    updateToVersion(db, 1800);

    const actual = sortBy(getTableData(db, 'defunctCallLinks'));

    assert.lengthOf(actual, 3);

    const item1 = actual[0];
    assert.strictEqual(item1?.roomId, 'roomId2');
    assert.isAtLeast(item1?.addedAt as number, now);
    assert.isAtLeast(item1?.storageNeedsSync as number, 1);

    const item2 = actual[1];
    assert.strictEqual(item2?.roomId, 'roomId3');
    assert.isNumber(item2?.addedAt);
    assert.isAtLeast(item2?.addedAt as number, now);
    assert.isAtLeast(item1?.storageNeedsSync as number, 1);

    const item3 = actual[2];
    assert.strictEqual(item3?.roomId, 'roomId4');
    assert.isNumber(item3?.addedAt);
    assert.isAtLeast(item3?.addedAt as number, now);
    assert.isAtLeast(item1?.storageNeedsSync as number, 1);
  });

  it('addes a NOT NULL constraint without a table rebuild', () => {
    updateToVersion(db, 1790);
    const beforeResult = db
      .prepare(
        "SELECT sql from sqlite_schema WHERE name = 'defunctCallLinks'",
        { pluck: true }
      )
      .get();
    assert.notMatch(beforeResult, /addedAt INTEGER NOT NULL/);

    updateToVersion(db, 1800);
    const afterResult = db
      .prepare(
        "SELECT sql from sqlite_schema WHERE name = 'defunctCallLinks'",
        { pluck: true }
      )
      .get();
    assert.match(afterResult as string, /addedAt INTEGER NOT NULL/);
  });
});
