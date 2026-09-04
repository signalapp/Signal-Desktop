// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { cwd } from 'node:process';
import { assert } from 'chai';

import type {
  PageBackupMessagesCursorType,
  WritableDB,
} from '../../sql/Interface.std.ts';
import { DataReader, setupTests } from '../../sql/Server.node.ts';
import { createDB } from './helpers.node.ts';

describe('SQL/pageBackupMessages', () => {
  // Must match the LIMIT inside pageBackupMessages.
  const PAGE_SIZE = 1000;

  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    setupTests(db, { userDataPath: cwd() });
  });

  afterEach(() => {
    db.close();
  });

  function insertMessages(count: number): void {
    const stmt = db.prepare(`
      INSERT INTO messages (id, conversationId, json)
      VALUES ($id, $conversationId, $json)
    `);
    db.transaction(() => {
      for (let i = 0; i < count; i += 1) {
        stmt.run({
          id: `m${i}`,
          conversationId: 'c1',
          json: JSON.stringify({}),
        });
      }
    })();
  }

  function pageAll(): {
    ids: Array<string>;
    pages: number;
  } {
    const ids: Array<string> = [];
    let pages = 0;
    let cursor: PageBackupMessagesCursorType | undefined;

    while (!cursor?.done) {
      const { messages, cursor: nextCursor } = DataReader.pageBackupMessages(
        db,
        cursor
      );
      ids.push(...messages.map(message => message.id));
      cursor = nextCursor;
      pages += 1;

      assert.isBelow(pages, 100, 'pagination did not terminate');
    }

    return { ids, pages };
  }

  it('returns every message exactly once when paging', () => {
    const count = PAGE_SIZE * 2 + 500;
    insertMessages(count);

    const { ids } = pageAll();

    assert.strictEqual(ids.length, count, 'wrong number of messages');
    assert.strictEqual(
      new Set(ids).size,
      count,
      'a message was returned more than once'
    );
  });

  it('does not repeat the row on a page boundary', () => {
    insertMessages(PAGE_SIZE + 1);

    const first = DataReader.pageBackupMessages(db);
    assert.strictEqual(first.messages.length, PAGE_SIZE);
    assert.isFalse(first.cursor.done);

    const second = DataReader.pageBackupMessages(db, first.cursor);
    assert.deepStrictEqual(
      second.messages.map(message => message.id),
      [`m${PAGE_SIZE}`],
      'second page must start after the last row of the first page'
    );
    assert.isTrue(second.cursor.done);
  });

  it('terminates on an exact multiple of the page size', () => {
    const count = PAGE_SIZE * 2;
    insertMessages(count);

    const { ids, pages } = pageAll();

    assert.strictEqual(ids.length, count);
    assert.strictEqual(new Set(ids).size, count);
    // Two full pages, then one empty page to learn that we are done.
    assert.strictEqual(pages, 3);
  });

  it('returns messages in ascending rowid order', () => {
    const count = PAGE_SIZE + 10;
    insertMessages(count);

    const { ids } = pageAll();

    const expected = Array.from({ length: count }, (_, i) => `m${i}`);
    assert.deepStrictEqual(ids, expected);
  });

  it('handles an empty table', () => {
    const { ids, pages } = pageAll();

    assert.deepStrictEqual(ids, []);
    assert.strictEqual(pages, 1);
  });
});
