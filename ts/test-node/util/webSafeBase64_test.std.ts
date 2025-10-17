// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  toWebSafeBase64,
  fromWebSafeBase64,
} from '../../util/webSafeBase64.std.js';

describe('both/util/webSafeBase64', () => {
  it('roundtrips with all elements', () => {
    const base64 = 'X0KjoAj3h7Tu9YjJ++PamFc4kAg//D4FKommANpP41I=';

    const webSafe = toWebSafeBase64(base64);
    const actual = fromWebSafeBase64(webSafe);

    assert.strictEqual(base64, actual);
  });

  describe('#toWebSafeBase64', () => {
    it('replaces +', () => {
      const base64 = 'X++y';
      const expected = 'X--y';
      const actual = toWebSafeBase64(base64);

      assert.strictEqual(expected, actual);
    });

    it('replaces /', () => {
      const base64 = 'X//y';
      const expected = 'X__y';
      const actual = toWebSafeBase64(base64);

      assert.strictEqual(expected, actual);
    });

    it('removes =', () => {
      const base64 = 'X===';
      const expected = 'X';
      const actual = toWebSafeBase64(base64);

      assert.strictEqual(expected, actual);
    });
  });

  describe('#fromWebSafeBase64', () => {
    it('replaces -', () => {
      const webSafeBase64 = 'X--y';
      const expected = 'X++y';
      const actual = fromWebSafeBase64(webSafeBase64);

      assert.strictEqual(expected, actual);
    });

    it('replaces _', () => {
      const webSafeBase64 = 'X__y';
      const expected = 'X//y';
      const actual = fromWebSafeBase64(webSafeBase64);

      assert.strictEqual(expected, actual);
    });

    it('adds ===', () => {
      const webSafeBase64 = 'X';
      const expected = 'X===';
      const actual = fromWebSafeBase64(webSafeBase64);

      assert.strictEqual(expected, actual);
    });

    it('adds ==', () => {
      const webSafeBase64 = 'Xy';
      const expected = 'Xy==';
      const actual = fromWebSafeBase64(webSafeBase64);

      assert.strictEqual(expected, actual);
    });

    it('adds =', () => {
      const webSafeBase64 = 'XyZ';
      const expected = 'XyZ=';
      const actual = fromWebSafeBase64(webSafeBase64);

      assert.strictEqual(expected, actual);
    });
  });
});
