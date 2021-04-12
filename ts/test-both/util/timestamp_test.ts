// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { isOlderThan, isMoreRecentThan } from '../../util/timestamp';

const ONE_HOUR = 3600 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

describe('timestamp', () => {
  describe('isOlderThan', () => {
    it('returns false on recent and future timestamps', () => {
      assert.isFalse(isOlderThan(Date.now(), ONE_DAY));
      assert.isFalse(isOlderThan(Date.now() + ONE_DAY, ONE_DAY));
    });

    it('returns true on old enough timestamps', () => {
      assert.isFalse(isOlderThan(Date.now() - ONE_DAY + ONE_HOUR, ONE_DAY));
      assert.isTrue(isOlderThan(Date.now() - ONE_DAY - ONE_HOUR, ONE_DAY));
    });
  });

  describe('isMoreRecentThan', () => {
    it('returns true on recent and future timestamps', () => {
      assert.isTrue(isMoreRecentThan(Date.now(), ONE_DAY));
      assert.isTrue(isMoreRecentThan(Date.now() + ONE_DAY, ONE_DAY));
    });

    it('returns false on old enough timestamps', () => {
      assert.isTrue(isMoreRecentThan(Date.now() - ONE_DAY + ONE_HOUR, ONE_DAY));
      assert.isFalse(
        isMoreRecentThan(Date.now() - ONE_DAY - ONE_HOUR, ONE_DAY)
      );
    });
  });
});
