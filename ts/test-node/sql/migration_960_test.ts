// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import type { WritableDB } from '../../sql/Interface';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';

const CONVO_ID = generateGuid();
const OUR_ACI = generateGuid();
const OUR_UNPREFIXED_PNI = generateGuid();
const OUR_PREFIXED_PNI = `PNI:${OUR_UNPREFIXED_PNI}`;

describe('SQL/updateToSchemaVersion960', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 950);

    insertData(db, 'items', [
      {
        id: 'uuid_id',
        json: {
          id: 'uuid_id',
          value: `${OUR_ACI}.1`,
        },
      },
      {
        id: 'pni',
        json: {
          id: 'pni',
          value: OUR_UNPREFIXED_PNI,
        },
      },
    ]);
  });

  afterEach(() => {
    db.close();
  });

  it('should migrate our conversation', () => {
    insertData(db, 'conversations', [
      {
        id: CONVO_ID,
        type: 'direct',
        serviceId: OUR_ACI,
        json: {
          id: CONVO_ID,
          serviceId: OUR_ACI,
          pni: OUR_UNPREFIXED_PNI,
        },
      },
    ]);
    updateToVersion(db, 960);
    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: CONVO_ID,
        type: 'direct',
        serviceId: OUR_ACI,
        json: {
          id: CONVO_ID,
          serviceId: OUR_ACI,
          pni: OUR_PREFIXED_PNI,
        },
      },
    ]);
  });

  it('should migrate items', () => {
    insertData(db, 'items', [
      {
        id: 'registrationIdMap',
        json: {
          id: 'registrationIdMap',
          value: {
            [OUR_ACI]: 123,
            [OUR_UNPREFIXED_PNI]: 456,
          },
        },
      },
      {
        id: 'identityKeyMap',
        json: {
          id: 'identityKeyMap',
          value: {
            [OUR_ACI]: {},
            [OUR_UNPREFIXED_PNI]: {},
          },
        },
      },
    ]);
    updateToVersion(db, 960);
    assert.deepStrictEqual(getTableData(db, 'items'), [
      {
        id: 'uuid_id',
        json: {
          id: 'uuid_id',
          value: `${OUR_ACI}.1`,
        },
      },
      {
        id: 'pni',
        json: {
          id: 'pni',
          value: OUR_PREFIXED_PNI,
        },
      },
      {
        id: 'registrationIdMap',
        json: {
          id: 'registrationIdMap',
          value: {
            [OUR_ACI]: 123,
            [OUR_PREFIXED_PNI]: 456,
          },
        },
      },
      {
        id: 'identityKeyMap',
        json: {
          id: 'identityKeyMap',
          value: {
            [OUR_ACI]: {},
            [OUR_PREFIXED_PNI]: {},
          },
        },
      },
    ]);
  });

  for (const table of ['preKeys', 'signedPreKeys', 'kyberPreKeys']) {
    // eslint-disable-next-line no-loop-func
    it(`should migrate ${table}`, () => {
      insertData(db, table, [
        {
          id: `${OUR_ACI}:123`,
          json: {
            id: `${OUR_ACI}:123`,
            ourServiceId: OUR_ACI,
          },
        },
        {
          id: `${OUR_UNPREFIXED_PNI}:456`,
          json: {
            id: `${OUR_UNPREFIXED_PNI}:456`,
            ourServiceId: OUR_UNPREFIXED_PNI,
          },
        },
      ]);
      updateToVersion(db, 960);
      assert.deepStrictEqual(getTableData(db, table), [
        {
          id: `${OUR_ACI}:123`,
          json: {
            id: `${OUR_ACI}:123`,
            ourServiceId: OUR_ACI,
          },
          ourServiceId: OUR_ACI,
        },
        {
          id: `${OUR_PREFIXED_PNI}:456`,
          json: {
            id: `${OUR_PREFIXED_PNI}:456`,
            ourServiceId: OUR_PREFIXED_PNI,
          },
          ourServiceId: OUR_PREFIXED_PNI,
        },
      ]);
    });
  }
});
