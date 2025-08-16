// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';

const DEFAULTS = {
  id: 'id',
  type: 0,
  timestamp: 1,
  attempts: 2,
  receivedAtCounter: 3,
  urgent: 1,
  story: 1,
  serverGuid: 'guid',
  serverTimestamp: 1,
  isEncrypted: 0,
  content: Buffer.from('68656c6c6f', 'hex'),
  messageAgeSec: 1,
  destinationServiceId: 'dest',
};

describe('SQL/updateToSchemaVersion1290', () => {
  let db: WritableDB;

  afterEach(() => {
    db.close();
  });

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1280);
  });

  it('transitions null sourceDevice', () => {
    insertData(db, 'unprocessed', [
      {
        ...DEFAULTS,

        sourceDevice: null,
      },
    ]);
    updateToVersion(db, 1290);

    assert.deepStrictEqual(getTableData(db, 'unprocessed'), [
      {
        ...DEFAULTS,

        content: '68656c6c6f',
      },
    ]);
  });

  it('transitions number sourceDevice', () => {
    insertData(db, 'unprocessed', [
      {
        ...DEFAULTS,

        sourceDevice: '123',
      },
    ]);
    updateToVersion(db, 1290);

    assert.deepStrictEqual(getTableData(db, 'unprocessed'), [
      {
        ...DEFAULTS,

        content: '68656c6c6f',
        sourceDevice: 123,
      },
    ]);
  });
});
