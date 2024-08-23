// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { WritableDB } from '../../sql/Interface';
import {
  incrementMessagesMigrationAttempts,
  setupTests,
} from '../../sql/Server';
import { createDB, insertData, getTableData } from './helpers';

describe('SQL/incrementMessagesMigrationAttempts', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    setupTests(db);
  });

  afterEach(() => {
    db.close();
  });

  function compactify(
    message: Record<string, unknown>
  ): Record<string, unknown> {
    const { id, conversationId, json } = message;

    return {
      id,
      conversationId,
      json,
    };
  }

  it('should increment attempts for corrupted messages', () => {
    insertData(db, 'messages', [
      {
        id: 'id',
        conversationId: 'other',
        json: {
          sent_at: { low: 0, high: 0 },
        },
      },
    ]);

    incrementMessagesMigrationAttempts(db, ['id']);

    assert.deepStrictEqual(getTableData(db, 'messages').map(compactify), [
      {
        id: 'id',
        conversationId: 'other',
        json: {
          schemaMigrationAttempts: 1,
          sent_at: { low: 0, high: 0 },
        },
      },
    ]);

    incrementMessagesMigrationAttempts(db, ['id']);

    assert.deepStrictEqual(getTableData(db, 'messages').map(compactify), [
      {
        id: 'id',
        conversationId: 'other',
        json: {
          schemaMigrationAttempts: 2,
          sent_at: { low: 0, high: 0 },
        },
      },
    ]);
  });
});
