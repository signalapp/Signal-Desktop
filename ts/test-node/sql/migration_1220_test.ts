// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface';
import {
  sessionRecordToProtobuf,
  sessionStructureToBytes,
} from '../../util/sessionTranslation';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';
import { SESSION_V1_RECORD } from '../../test-both/util/sessionTranslation_test';

const MAPS = [
  {
    id: 'identityKeyMap',
    json: {
      id: 'identityKeyMap',
      value: {
        ourAci: {
          privKey: 'AAAA',
          pubKey: 'AAAA',
        },
      },
    },
  },
  {
    id: 'registrationIdMap',
    json: {
      id: 'registrationIdMap',
      value: {
        ourAci: 123,
      },
    },
  },
];

const SESSION_V2 = {
  id: 'ourAci:theirAci',
  conversationId: 'cid',
  ourServiceId: 'ourAci',
  serviceId: 'theirAci',
  json: {
    id: 'ourAci:theirAci',
    conversationId: 'cid',
    ourServiceId: 'ourAci',
    serviceId: 'theirAci',
    version: 2,
    deviceId: 3,
    record: Buffer.from('abc').toString('base64'),
  },
};

describe('SQL/updateToSchemaVersion1220', () => {
  let db: WritableDB;

  afterEach(() => {
    db.close();
  });

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1210);
  });

  it('drops sessions without identity key/registration id', () => {
    insertData(db, 'sessions', [SESSION_V2]);
    updateToVersion(db, 1220);

    assert.deepStrictEqual(getTableData(db, 'sessions'), []);
  });

  it('migrates v1 session', () => {
    insertData(db, 'items', MAPS);
    insertData(db, 'sessions', [
      {
        id: 'ourAci:theirAci',
        conversationId: 'cid',
        ourServiceId: 'ourAci',
        serviceId: 'theirAci',
        json: {
          id: 'ourAci:theirAci',
          conversationId: 'cid',
          ourServiceId: 'ourAci',
          serviceId: 'theirAci',
          version: 1,
          deviceId: 3,
          record: JSON.stringify(SESSION_V1_RECORD),
        },
      },
    ]);
    updateToVersion(db, 1220);

    const bytes = sessionStructureToBytes(
      sessionRecordToProtobuf(SESSION_V1_RECORD, {
        identityKeyPublic: Buffer.from('AAAA', 'base64'),
        registrationId: 123,
      })
    );

    assert.deepStrictEqual(getTableData(db, 'sessions'), [
      {
        id: 'ourAci:theirAci',
        conversationId: 'cid',
        ourServiceId: 'ourAci',
        serviceId: 'theirAci',
        deviceId: 3,
        record: Buffer.from(bytes).toString('hex'),
      },
    ]);
  });

  it('migrates v2 session', () => {
    insertData(db, 'items', MAPS);
    insertData(db, 'sessions', [SESSION_V2]);
    updateToVersion(db, 1220);

    assert.deepStrictEqual(getTableData(db, 'sessions'), [
      {
        id: 'ourAci:theirAci',
        conversationId: 'cid',
        ourServiceId: 'ourAci',
        serviceId: 'theirAci',
        deviceId: 3,
        record: Buffer.from('abc').toString('hex'),
      },
    ]);
  });

  it('drops invalid sessions', () => {
    insertData(db, 'items', MAPS);
    insertData(db, 'sessions', [
      {
        id: 'ourAci:theirAci',
        conversationId: 'cid',
        ourServiceId: 'ourAci',
        serviceId: 'theirAci',
        json: {
          id: 'ourAci:theirAci2',
          conversationId: 'cid',
          ourServiceId: 'ourAci',
          serviceId: 'theirAci',
          version: 1,
          deviceId: 3,
          record: 'abc',
        },
      },
    ]);
    updateToVersion(db, 1220);

    assert.deepStrictEqual(getTableData(db, 'sessions'), []);
  });
});
