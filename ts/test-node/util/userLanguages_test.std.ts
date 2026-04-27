// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { getUserLanguages } from '../../util/userLanguages.std.ts';

describe('user language utilities', () => {
  describe('getUserLanguages', () => {
    it('returns the fallback if no languages are provided', () => {
      assert.deepEqual(getUserLanguages([], 'fallback'), ['fallback']);
      assert.deepEqual(getUserLanguages(undefined, 'fallback'), ['fallback']);
    });

    it('returns the provided languages', () => {
      assert.deepEqual(getUserLanguages(['a', 'b', 'c'], 'x'), ['a', 'b', 'c']);
    });
  });
});
