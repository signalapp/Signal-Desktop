// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';
import { range } from 'lodash';

import { createDB, getTableData, insertData, updateToVersion } from './helpers';
import type { ServiceIdString } from '../../types/ServiceId';
import { normalizePni } from '../../types/ServiceId';
import { normalizeAci } from '../../util/normalizeAci';
import type { WritableDB, PreKeyType } from '../../sql/Interface';

type TestingPreKey = Omit<
  PreKeyType,
  'privateKey' | 'publicKey' | 'createdAt'
> & {
  createdAt: number | undefined;
};

describe('SQL/updateToSchemaVersion91', () => {
  let db: WritableDB;

  const OUR_ACI = normalizeAci(generateGuid(), 'updateToSchemaVersion91 test');
  const OUR_PNI = normalizePni(
    `PNI:${generateGuid()}`,
    'updateToSchemaVersion91 test'
  );
  let idCount = 0;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 90);
  });

  afterEach(() => {
    db.close();
  });

  function addPni() {
    insertData(db, 'items', [
      {
        id: 'pni',
        json: {
          id: 'pni',
          value: OUR_PNI,
        },
      },
    ]);
  }

  function getCountOfKeys(): number {
    return db.prepare('SELECT count(*) FROM preKeys;').pluck(true).get();
  }

  function getPragma(): number {
    return db.prepare('PRAGMA user_version;').pluck(true).get();
  }

  function generateKey(
    createdAt: number | undefined,
    ourServiceId: ServiceIdString
  ): TestingPreKey {
    idCount += 1;

    return {
      createdAt,
      id: `${ourServiceId}:${idCount}`,
      keyId: idCount,
      ourServiceId,
    };
  }

  function getRangeOfKeysForInsert(
    start: number,
    end: number,
    ourServiceId: ServiceIdString,
    options?: {
      clearCreatedAt?: boolean;
    }
  ): Array<{ id: string; json: TestingPreKey }> {
    return range(start, end).map(createdAt => {
      const key = generateKey(
        options?.clearCreatedAt ? undefined : createdAt,
        ourServiceId
      );

      return {
        id: key.id,
        json: key,
      };
    });
  }

  it('handles missing PNI', () => {
    assert.strictEqual(0, getCountOfKeys());
    insertData(db, 'preKeys', getRangeOfKeysForInsert(0, 1500, OUR_ACI));
    assert.strictEqual(1500, getCountOfKeys());
    assert.strictEqual(90, getPragma());

    updateToVersion(db, 91);

    assert.strictEqual(91, getPragma());
    assert.strictEqual(1500, getCountOfKeys());
  });

  it('deletes 500 extra keys', () => {
    assert.strictEqual(0, getCountOfKeys());
    addPni();
    insertData(db, 'preKeys', getRangeOfKeysForInsert(0, 1500, OUR_PNI));
    assert.strictEqual(1500, getCountOfKeys());
    assert.strictEqual(90, getPragma());

    updateToVersion(db, 91);

    assert.strictEqual(91, getPragma());
    assert.strictEqual(1000, getCountOfKeys());
  });

  it('leaves 1000 existing keys alone', () => {
    assert.strictEqual(0, getCountOfKeys());
    addPni();
    insertData(db, 'preKeys', getRangeOfKeysForInsert(0, 1000, OUR_PNI));
    assert.strictEqual(1000, getCountOfKeys());
    assert.strictEqual(90, getPragma());

    updateToVersion(db, 91);

    assert.strictEqual(91, getPragma());
    assert.strictEqual(1000, getCountOfKeys());
  });

  it('leaves keys with missing createdAt alone', () => {
    assert.strictEqual(0, getCountOfKeys());
    addPni();
    insertData(
      db,
      'preKeys',
      getRangeOfKeysForInsert(0, 1500, OUR_PNI, { clearCreatedAt: true })
    );
    assert.strictEqual(1500, getCountOfKeys());
    assert.strictEqual(90, getPragma());

    updateToVersion(db, 91);

    assert.strictEqual(91, getPragma());
    assert.strictEqual(1500, getCountOfKeys());
  });

  it('leaves extra ACI keys alone, even if above 1000', () => {
    assert.strictEqual(0, getCountOfKeys());
    addPni();
    insertData(db, 'preKeys', getRangeOfKeysForInsert(0, 1500, OUR_ACI));
    assert.strictEqual(1500, getCountOfKeys());
    assert.strictEqual(90, getPragma());

    updateToVersion(db, 91);

    assert.strictEqual(91, getPragma());
    assert.strictEqual(1500, getCountOfKeys());
  });

  it('fixes ourServiceId generated column in preKeys table', () => {
    updateToVersion(db, 91);
    const id = 1;

    insertData(db, 'preKeys', [
      {
        id,
        json: {
          ourServiceId: OUR_ACI,
        },
      },
    ]);
    assert.deepEqual(getTableData(db, 'preKeys'), [
      {
        id,
        ourServiceId: OUR_ACI,
        json: {
          ourServiceId: OUR_ACI,
        },
      },
    ]);
  });

  it('fixes ourServiceId generated column in kyberPreKeys table', () => {
    updateToVersion(db, 91);
    const id = 1;

    insertData(db, 'kyberPreKeys', [
      {
        id,
        json: {
          ourServiceId: OUR_ACI,
        },
      },
    ]);
    assert.deepEqual(getTableData(db, 'kyberPreKeys'), [
      {
        id,
        ourServiceId: OUR_ACI,
        json: {
          ourServiceId: OUR_ACI,
        },
      },
    ]);
  });

  it('fixes ourServiceId generated column in signedPreKeys table', () => {
    updateToVersion(db, 91);
    const id = 1;

    insertData(db, 'signedPreKeys', [
      {
        id,
        json: {
          ourServiceId: OUR_ACI,
        },
      },
    ]);
    assert.deepEqual(getTableData(db, 'signedPreKeys'), [
      {
        id,
        ourServiceId: OUR_ACI,
        json: {
          ourServiceId: OUR_ACI,
        },
      },
    ]);
  });
});
