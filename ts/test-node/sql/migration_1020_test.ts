// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateGuid } from 'uuid';

import { normalizeAci } from '../../util/normalizeAci';
import type { WritableDB } from '../../sql/Interface';
import { createDB, insertData, getTableData, updateToVersion } from './helpers';

describe('SQL/updateToSchemaVersion1020', () => {
  let db: WritableDB;

  const OUR_ACI = normalizeAci(
    generateGuid(),
    'updateToSchemaVersion1020 test'
  );
  const THEIR_ACI = normalizeAci(
    generateGuid(),
    'updateToSchemaVersion1020 test'
  );

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1010);
  });

  afterEach(() => {
    db.close();
  });

  it('removes self merges and nothing else', () => {
    insertData(db, 'items', [
      {
        id: 'uuid_id',
        json: {
          id: 'uuid_id',
          value: `${OUR_ACI}.2`,
        },
      },
    ]);

    insertData(db, 'conversations', [
      {
        id: 'us',
        serviceId: OUR_ACI,
      },
      {
        id: 'them',
        serviceId: THEIR_ACI,
      },
    ]);

    insertData(db, 'messages', [
      {
        id: 'a',
        conversationId: 'us',
        type: 'conversation-merge',
      },
      {
        id: 'b',
        conversationId: 'us',
        type: 'incoming',
      },
      {
        id: 'c',
        conversationId: 'them',
        type: 'conversation-merge',
      },
      {
        id: 'd',
        conversationId: 'them',
        type: 'incoming',
      },
    ]);

    updateToVersion(db, 1020);

    assert.deepStrictEqual(
      getTableData(db, 'messages').map(m => m.id),
      ['b', 'c', 'd']
    );
  });
});
