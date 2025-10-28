// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isValid } from '../../types/SchemaVersion.std.js';

describe('SchemaVersion', () => {
  describe('isValid', () => {
    it('should return true for positive integers', () => {
      assert.isTrue(isValid(0));
      assert.isTrue(isValid(1));
      assert.isTrue(isValid(2));
    });

    it('should return false for any other value', () => {
      assert.isFalse(isValid(null));
      assert.isFalse(isValid(-1));
      assert.isFalse(isValid(''));
    });
  });
});
