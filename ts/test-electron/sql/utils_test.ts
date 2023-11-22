// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { Database } from '@signalapp/better-sqlite3';
import SQL from '@signalapp/better-sqlite3';
import { sql, sqlFragment, sqlJoin } from '../../sql/util';

describe('sql/utils/sql', () => {
  let db: Database;

  beforeEach(() => {
    db = new SQL(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('can run different query types with nested sql syntax', async () => {
    const [createQuery, createParams] = sql`
      CREATE TABLE examples (
        id INTEGER PRIMARY KEY,
        body TEXT
      );
    `;
    db.prepare(createQuery).run(createParams);

    const [insertQuery, insertParams] = sql`
      INSERT INTO examples (id, body) VALUES
        (1, 'foo'),
        (2, 'bar'),
        (3, 'baz');
    `;
    db.prepare(insertQuery).run(insertParams);

    const predicate = sqlFragment`body = ${'baz'}`;

    const [selectQuery, selectParams] = sql`
      SELECT * FROM examples WHERE
        id IN (${sqlJoin([1, 2])}) OR
        ${predicate};
    `;

    const result = db.prepare(selectQuery).all(selectParams);

    assert.deepEqual(result, [
      { id: 1, body: 'foo' },
      { id: 2, body: 'bar' },
      { id: 3, body: 'baz' },
    ]);
  });
});
