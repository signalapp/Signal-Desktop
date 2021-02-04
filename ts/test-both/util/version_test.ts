// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isBeta } from '../../util/version';

describe('version utilities', () => {
  describe('isBeta', () => {
    it('returns false for non-beta version strings', () => {
      assert.isFalse(isBeta('1.2.3'));
      assert.isFalse(isBeta('1.2.3-alpha'));
      assert.isFalse(isBeta('1.2.3-alpha.1'));
      assert.isFalse(isBeta('1.2.3-rc.1'));
    });

    it('returns true for beta version strings', () => {
      assert.isTrue(isBeta('1.2.3-beta'));
      assert.isTrue(isBeta('1.2.3-beta.1'));
    });
  });
});
