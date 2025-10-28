// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { count } from '../../util/characters.std.js';

describe('character utilities', () => {
  describe('count', () => {
    it('returns the number of characters in a string (not necessarily the length)', () => {
      assert.strictEqual(count(''), 0);
      assert.strictEqual(count('hello'), 5);
      assert.strictEqual(count('Bokmål'), 6);
      assert.strictEqual(count('💩💩💩'), 3);
      assert.strictEqual(count('👩‍❤️‍👩'), 6);
      assert.strictEqual(count('Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢L̠ͨͧͩ͘G̴̻͈͍͔̹̑͗̎̅͛́Ǫ̵̹̻̝̳͂̌̌͘'), 58);
    });
  });
});
