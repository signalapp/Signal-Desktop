// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import type { WritableDB } from '../../sql/Interface.std.ts';
import {
  createDB,
  getTableData,
  insertData,
  updateToVersion,
} from './helpers.node.ts';

describe('SQL/updateToSchemaVersion1710', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    updateToVersion(db, 1700);
  });

  afterEach(() => {
    db.close();
  });

  type Item = { id: string; json: { id: string; value: string } };

  function item(id: string, value: string): Item {
    return { id, json: { id, value } };
  }

  function skinToneItem(value: string): Item {
    return item('emojiSkinToneDefault', value);
  }

  function check(input: Array<Item>, expected: Array<Item>) {
    insertData(db, 'items', input);
    updateToVersion(db, 1710);
    assert.deepEqual(getTableData(db, 'items'), expected);
  }

  function testMappedCase(from: string, to: string) {
    it(`maps "${from}" to "${to}"`, () => {
      check([skinToneItem(from)], [skinToneItem(to)]);
    });
  }

  testMappedCase('EmojiSkinTone.None', '');
  testMappedCase('EmojiSkinTone.Type1', '1F3FB');
  testMappedCase('EmojiSkinTone.Type2', '1F3FC');
  testMappedCase('EmojiSkinTone.Type3', '1F3FD');
  testMappedCase('EmojiSkinTone.Type4', '1F3FE');
  testMappedCase('EmojiSkinTone.Type5', '1F3FF');

  it('falls back to empty string for unexpected values', () => {
    check([skinToneItem('something-unexpected')], [skinToneItem('')]);
  });

  it('leaves other items rows untouched', () => {
    const other = item('somethingElse', 'EmojiSkinTone.Type2');
    check([other], [other]);
  });
});
