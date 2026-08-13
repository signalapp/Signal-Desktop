// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createDB,
  updateToVersion,
  insertData,
  getTableData,
} from './helpers.node.ts';
import { getRandomBytes } from '../../Crypto.node.ts';
import { sortBy } from 'lodash';

describe('SQL/updateToSchemaVersion1770', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
  });

  afterEach(() => {
    db.close();
  });

  const E164_1 = '+18005551111';
  const E164_2 = '+18005551112';
  const UUID_1 = generateUuid();
  const UUID_2 = generateUuid();
  const GROUP_1 = getRandomBytes(32).toBase64();
  const GROUP_2 = getRandomBytes(32).toBase64();

  it('removes the cached attachment but preserves the author', () => {
    updateToVersion(db, 1760);
    insertData(db, 'items', [
      {
        id: 'blocked',
        json: {
          id: 'blocked',
          value: [E164_1, E164_2],
        },
      },
      {
        id: 'blocked-groups',
        json: {
          id: 'blocked-groups',
          value: [GROUP_1, GROUP_2],
        },
      },
      {
        id: 'blocked-uuids',
        json: {
          id: 'blocked-uuids',
          value: [UUID_1, UUID_2],
        },
      },
    ]);

    updateToVersion(db, 1770);

    assert.deepStrictEqual(sortBy(getTableData(db, 'items'), 'id'), [
      {
        id: 'blocked',
        json: {
          id: 'blocked',
          value: [{ e164: E164_1 }, { e164: E164_2 }],
        },
      },
      {
        id: 'blocked-groups',
        json: {
          id: 'blocked-groups',
          value: [{ groupId: GROUP_1 }, { groupId: GROUP_2 }],
        },
      },
      {
        id: 'blocked-uuids',
        json: {
          id: 'blocked-uuids',
          value: [{ serviceId: UUID_1 }, { serviceId: UUID_2 }],
        },
      },
    ]);
  });
});
