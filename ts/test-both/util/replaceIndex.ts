// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { replaceIndex } from '../../util/replaceIndex';

describe('replaceIndex', () => {
  it('returns a new array with an index replaced', () => {
    const original = ['a', 'b', 'c', 'd'];
    const replaced = replaceIndex(original, 2, 'X');

    assert.deepStrictEqual(replaced, ['a', 'b', 'X', 'd']);
    assert.deepStrictEqual(original, ['a', 'b', 'c', 'd']);
  });

  it('appends the value if the index is out of range', () => {
    const original = ['a', 'b', 'c'];

    [-1, 1.2, 4, Infinity, NaN].forEach(index => {
      const replaced = replaceIndex(original, index, 'X');
      assert.deepStrictEqual(replaced, ['a', 'b', 'c', 'X']);
    });
  });
});
