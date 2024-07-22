// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';
import { range } from 'lodash';

import { createDB, insertData, updateToVersion } from './helpers';
import type { ServiceIdString } from '../../types/ServiceId';
import { normalizePni } from '../../types/ServiceId';
import { normalizeAci } from '../../util/normalizeAci';
import type {
  WritableDB,
  KyberPreKeyType,
  SignedPreKeyType,
} from '../../sql/Interface';

type TestingKyberKey = Omit<
  KyberPreKeyType,
  'data' | 'isLastResort' | 'isConfirmed' | 'createdAt'
> & {
  createdAt: number | undefined;
};
type TestingSignedKey = Omit<
  SignedPreKeyType,
  'privateKey' | 'publicKey' | 'confirmed' | 'created_at'
> & {
  created_at: number | undefined;
};

describe('SQL/updateToSchemaVersion92', () => {
  let db: WritableDB;

  const OUR_ACI = normalizeAci(generateGuid(), 'updateToSchemaVersion92 test');
  const OUR_PNI = normalizePni(
    `PNI:${generateGuid()}`,
    'updateToSchemaVersion92 test'
  );
  let idCount = 0;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 91);
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

  function getCountOfKyberKeys(): number {
    return db.prepare('SELECT count(*) FROM kyberPreKeys;').pluck(true).get();
  }
  function getCountOfSignedKeys(): number {
    return db.prepare('SELECT count(*) FROM signedPreKeys;').pluck(true).get();
  }

  function getPragma(): number {
    return db.prepare('PRAGMA user_version;').pluck(true).get();
  }

  function generateKyberKey(
    createdAt: number | undefined,
    ourServiceId: ServiceIdString
  ): TestingKyberKey {
    idCount += 1;

    return {
      createdAt,
      id: `${ourServiceId}:${idCount}`,
      keyId: idCount,
      ourServiceId,
    };
  }

  function generateSignedKey(
    createdAt: number | undefined,
    ourServiceId: ServiceIdString
  ): TestingSignedKey {
    idCount += 1;

    return {
      created_at: createdAt,
      id: `${ourServiceId}:${idCount}`,
      keyId: idCount,
      ourServiceId,
    };
  }

  function getRangeOfKyberKeysForInsert(
    start: number,
    end: number,
    ourServiceId: ServiceIdString,
    options?: {
      clearCreatedAt?: boolean;
    }
  ): Array<{ id: string; json: TestingKyberKey }> {
    return range(start, end).map(createdAt => {
      const key = generateKyberKey(
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
    assert.strictEqual(0, getCountOfKyberKeys());
    insertData(
      db,
      'kyberPreKeys',
      getRangeOfKyberKeysForInsert(0, 3000, OUR_ACI)
    );
    assert.strictEqual(3000, getCountOfKyberKeys());
    assert.strictEqual(91, getPragma());

    updateToVersion(db, 920);

    assert.strictEqual(920, getPragma());
    assert.strictEqual(3000, getCountOfKyberKeys());
  });

  describe('kyberPreKeys', () => {
    it('deletes 2000 extra keys', () => {
      assert.strictEqual(0, getCountOfKyberKeys());
      addPni();
      insertData(
        db,
        'kyberPreKeys',
        getRangeOfKyberKeysForInsert(0, 3000, OUR_PNI)
      );
      assert.strictEqual(3000, getCountOfKyberKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(1000, getCountOfKyberKeys());
    });

    it('leaves 1000 existing keys alone', () => {
      assert.strictEqual(0, getCountOfKyberKeys());
      addPni();
      insertData(
        db,
        'kyberPreKeys',
        getRangeOfKyberKeysForInsert(0, 1000, OUR_PNI)
      );
      assert.strictEqual(1000, getCountOfKyberKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(1000, getCountOfKyberKeys());
    });

    it('leaves keys with missing createdAt alone', () => {
      assert.strictEqual(0, getCountOfKyberKeys());
      addPni();
      insertData(
        db,
        'kyberPreKeys',
        getRangeOfKyberKeysForInsert(0, 3000, OUR_PNI, { clearCreatedAt: true })
      );
      assert.strictEqual(3000, getCountOfKyberKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(3000, getCountOfKyberKeys());
    });

    it('leaves extra ACI keys alone, even if above 1000', () => {
      assert.strictEqual(0, getCountOfKyberKeys());
      addPni();
      insertData(
        db,
        'kyberPreKeys',
        getRangeOfKyberKeysForInsert(0, 3000, OUR_ACI)
      );
      assert.strictEqual(3000, getCountOfKyberKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(3000, getCountOfKyberKeys());
    });
  });

  describe('signedPreKeys', () => {
    function getRangeOfSignedKeysForInsert(
      start: number,
      end: number,
      ourServiceId: ServiceIdString,
      options?: {
        clearCreatedAt?: boolean;
      }
    ): Array<{ id: string; json: TestingSignedKey }> {
      return range(start, end).map(createdAt => {
        const key = generateSignedKey(
          options?.clearCreatedAt ? undefined : createdAt,
          ourServiceId
        );

        return {
          id: key.id,
          json: key,
        };
      });
    }

    it('deletes 2000 extra keys', () => {
      assert.strictEqual(0, getCountOfSignedKeys());
      addPni();
      insertData(
        db,
        'signedPreKeys',
        getRangeOfSignedKeysForInsert(0, 3000, OUR_PNI)
      );
      assert.strictEqual(3000, getCountOfSignedKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(1000, getCountOfSignedKeys());
    });

    it('leaves 1000 existing keys alone', () => {
      assert.strictEqual(0, getCountOfSignedKeys());
      addPni();
      insertData(
        db,
        'signedPreKeys',
        getRangeOfSignedKeysForInsert(0, 1000, OUR_PNI)
      );
      assert.strictEqual(1000, getCountOfSignedKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(1000, getCountOfSignedKeys());
    });

    it('leaves keys with missing createdAt alone', () => {
      assert.strictEqual(0, getCountOfSignedKeys());
      addPni();
      insertData(
        db,
        'signedPreKeys',
        getRangeOfSignedKeysForInsert(0, 3000, OUR_PNI, {
          clearCreatedAt: true,
        })
      );
      assert.strictEqual(3000, getCountOfSignedKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(3000, getCountOfSignedKeys());
    });

    it('leaves extra ACI keys alone, even if above 1000', () => {
      assert.strictEqual(0, getCountOfSignedKeys());
      addPni();
      insertData(
        db,
        'signedPreKeys',
        getRangeOfSignedKeysForInsert(0, 3000, OUR_ACI)
      );
      assert.strictEqual(3000, getCountOfSignedKeys());
      assert.strictEqual(91, getPragma());

      updateToVersion(db, 920);

      assert.strictEqual(920, getPragma());
      assert.strictEqual(3000, getCountOfSignedKeys());
    });
  });
});
