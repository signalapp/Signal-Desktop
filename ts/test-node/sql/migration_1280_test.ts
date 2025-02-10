// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { type WritableDB } from '../../sql/Interface';
import { SignalService as Proto } from '../../protobuf';
import { generateAci } from '../../types/ServiceId';
import { createDB, updateToVersion, insertData, getTableData } from './helpers';

describe('SQL/updateToSchemaVersion1280', () => {
  let db: WritableDB;

  const OUR_ACI = generateAci();
  const THEIR_ACI = generateAci();

  afterEach(() => {
    db.close();
  });

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1270);

    insertData(db, 'items', [
      {
        id: 'uuid_id',
        json: {
          id: 'uuid_id',
          value: `${OUR_ACI}.2`,
        },
      },
    ]);
  });

  it('drops v1 envelopes', () => {
    insertData(db, 'unprocessed', [
      {
        id: 'old',
      },
    ]);
    updateToVersion(db, 1280);

    assert.deepStrictEqual(getTableData(db, 'unprocessed'), []);
  });

  it('does not drop v2 envelopes', () => {
    insertData(db, 'unprocessed', [
      {
        id: 'new',
        version: 2,

        receivedAtCounter: 1,
        story: 1,
        urgent: 1,
        timestamp: 4,
        attempts: 5,
        envelope: Buffer.from(
          Proto.Envelope.encode({
            destinationServiceId: THEIR_ACI,
            content: Buffer.from('encrypted1'),
            reportSpamToken: Buffer.from('token'),
          }).finish()
        ).toString('base64'),
        serverTimestamp: 6,
        serverGuid: 'guid1',
      },
      {
        id: 'new-2',
        version: 2,

        receivedAtCounter: 2,
        story: 1,
        urgent: 1,
        timestamp: 4,
        attempts: 5,
        envelope: Buffer.from(
          Proto.Envelope.encode({
            type: 3,
            content: Buffer.from('encrypted2'),
          }).finish()
        ).toString('base64'),
        serverTimestamp: 7,
        serverGuid: 'guid2',
      },
      {
        id: 'new-3',
        version: 2,

        receivedAtCounter: 3,
        story: 0,
        urgent: 0,
        timestamp: 5,
        attempts: 6,
        envelope: Buffer.from(
          Proto.Envelope.encode({
            content: Buffer.from('unused'),
          }).finish()
        ).toString('base64'),
        decrypted: 'CAFE',
        serverTimestamp: 8,
        serverGuid: 'guid3',
      },
    ]);
    updateToVersion(db, 1280);

    assert.deepStrictEqual(getTableData(db, 'unprocessed'), [
      {
        id: 'new',

        type: 0,
        receivedAtCounter: 1,
        story: 1,
        urgent: 1,
        messageAgeSec: 0,
        timestamp: 4,
        attempts: 5,
        destinationServiceId: THEIR_ACI,
        content: '656e6372797074656431',
        isEncrypted: 1,
        serverTimestamp: 6,
        serverGuid: 'guid1',
        reportingToken: '746f6b656e',
      },
      {
        id: 'new-2',

        receivedAtCounter: 2,
        story: 1,
        urgent: 1,
        timestamp: 4,
        messageAgeSec: 0,
        attempts: 5,
        destinationServiceId: OUR_ACI,
        content: '656e6372797074656432',
        isEncrypted: 1,
        type: 3,
        serverTimestamp: 7,
        serverGuid: 'guid2',
      },
      {
        id: 'new-3',

        receivedAtCounter: 3,
        urgent: 0,
        story: 0,
        timestamp: 5,
        messageAgeSec: 0,
        attempts: 6,
        destinationServiceId: OUR_ACI,
        content: '080144',
        isEncrypted: 0,
        type: 0,
        serverTimestamp: 8,
        serverGuid: 'guid3',
      },
    ]);
  });
});
