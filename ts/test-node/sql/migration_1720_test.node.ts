// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import type { WritableDB } from '../../sql/Interface.std.ts';
import type { TableRows } from './helpers.node.ts';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.ts';

describe('SQL/updateToSchemaVersion1720', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1710);
  });

  afterEach(() => {
    db.close();
  });

  function oldRow(shortName: string | null, lastUsage: number | null) {
    return { shortName, lastUsage };
  }

  function newRow(emoji: string, lastUsedAt: number) {
    return { emoji, lastUsedAt };
  }

  function check(opts: { oldRows: TableRows; newRows: TableRows }) {
    insertData(db, 'emojis', opts.oldRows);
    updateToVersion(db, 1720);
    const rows = getTableData(db, 'recentEmojis');
    assert.deepEqual(rows, opts.newRows);
  }

  it('migrates rows with known shortNames into emoji + lastUsedAt', () => {
    check({
      oldRows: [oldRow('grinning', 1000), oldRow('joy', 2000)],
      newRows: [newRow('😀', 1000), newRow('😂', 2000)],
    });
  });

  it('drops invalid shortnames', () => {
    check({
      oldRows: [oldRow('not-real-emoji-shortname', 1000)],
      newRows: [],
    });
  });

  it('drops rows with missing values', () => {
    check({
      oldRows: [oldRow(null, 1000), oldRow('joy', null)],
      newRows: [],
    });
  });
});
