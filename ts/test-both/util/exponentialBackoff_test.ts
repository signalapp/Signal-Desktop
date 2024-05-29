// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as durations from '../../util/durations';

import {
  exponentialBackoffSleepTime,
  exponentialBackoffMaxAttempts,
} from '../../util/exponentialBackoff';

describe('exponential backoff utilities', () => {
  describe('exponentialBackoffSleepTime', () => {
    it('returns slowly growing values', () => {
      assert.strictEqual(exponentialBackoffSleepTime(1), 0);
      assert.strictEqual(exponentialBackoffSleepTime(2), 190);
      assert.strictEqual(exponentialBackoffSleepTime(3), 361);
      assert.approximately(exponentialBackoffSleepTime(4), 686, 1);
      assert.approximately(exponentialBackoffSleepTime(5), 1303, 1);
    });

    it('plateaus at a maximum after 15 attempts', () => {
      const maximum = 15 * durations.MINUTE;
      for (let attempt = 16; attempt < 100; attempt += 1) {
        assert.strictEqual(exponentialBackoffSleepTime(attempt), maximum);
      }
    });

    it('respects custom variables', () => {
      const options = {
        maxBackoffTime: 10000,
        multiplier: 2,
        firstBackoffs: [1000],
      };
      assert.strictEqual(exponentialBackoffSleepTime(1, options), 1000);
      assert.strictEqual(exponentialBackoffSleepTime(2, options), 2000);
      assert.strictEqual(exponentialBackoffSleepTime(3, options), 4000);
      assert.strictEqual(exponentialBackoffSleepTime(4, options), 8000);
      assert.strictEqual(exponentialBackoffSleepTime(5, options), 10000);
      assert.strictEqual(exponentialBackoffSleepTime(6, options), 10000);
    });
  });

  describe('exponentialBackoffMaxAttempts', () => {
    it('returns 2 attempts for a short period of time', () => {
      assert.strictEqual(exponentialBackoffMaxAttempts(1), 2);
      assert.strictEqual(exponentialBackoffMaxAttempts(99), 2);
    });

    it('returns 6 attempts for a 5 seconds', () => {
      assert.strictEqual(exponentialBackoffMaxAttempts(5000), 6);
    });

    it('returns 110 attempts for 1 day', () => {
      // This is a test case that is lifted from iOS's codebase.
      assert.strictEqual(exponentialBackoffMaxAttempts(durations.DAY), 110);
    });
  });
});
