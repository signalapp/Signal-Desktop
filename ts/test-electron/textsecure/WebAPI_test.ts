// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { makeKeysLowercase } from '../../textsecure/WebAPI.preload.js';

describe('WebAPI', () => {
  describe('makeKeysLowercase', () => {
    it('handles empty object', () => {
      const expected = Object.create(null);
      const actual = makeKeysLowercase({});
      assert.deepEqual(expected, actual);
    });
    it('handles one key', () => {
      const expected = Object.create(null);
      expected.low = 4;

      const actual = makeKeysLowercase({
        LOW: 4,
      });

      assert.deepEqual(expected, actual);
    });
    it('handles lots of keys', () => {
      const expected = Object.create(null);
      expected.one = 'one more';
      expected.two = 'two more';
      expected.three = 'three';

      const actual = makeKeysLowercase({
        One: 'one more',
        TWO: 'two more',
        ThreE: 'three',
      });

      assert.deepEqual(expected, actual);
    });
  });
});
