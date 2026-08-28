// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.ts';

describe('SQL/updateToSchemaVersion1790', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1780);
  });

  afterEach(() => {
    db.close();
  });

  it('sets notifyForMentionsIfMuted only when mentions were opted out, and always drops the old key', () => {
    insertData(db, 'conversations', [
      {
        id: 'c1-opted-out',
        expireTimerVersion: 1,
        json: {
          id: 'c1-opted-out',
          dontNotifyForMentionsIfMuted: true,
        },
      },
      {
        id: 'c2-opted-in',
        expireTimerVersion: 1,
        json: {
          id: 'c2-opted-in',
          dontNotifyForMentionsIfMuted: false,
        },
      },
      {
        id: 'c3-never-set',
        expireTimerVersion: 1,
        json: {
          id: 'c3-never-set',
        },
      },
    ]);

    updateToVersion(db, 1790);

    assert.deepStrictEqual(getTableData(db, 'conversations'), [
      {
        id: 'c1-opted-out',
        expireTimerVersion: 1,
        json: {
          id: 'c1-opted-out',
          notifyForMentionsIfMuted: false,
        },
      },
      {
        id: 'c2-opted-in',
        expireTimerVersion: 1,
        json: {
          id: 'c2-opted-in',
        },
      },
      {
        id: 'c3-never-set',
        expireTimerVersion: 1,
        json: {
          id: 'c3-never-set',
        },
      },
    ]);
  });
});
