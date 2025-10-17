// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { HOUR, DAY } from '../../util/durations/index.std.js';

import {
  isMoreRecentThan,
  isOlderThan,
  isSameDay,
  isToday,
  toDayMillis,
} from '../../util/timestamp.std.js';

const FAKE_NOW = new Date('2020-01-23T04:56:00.000');

describe('timestamp', () => {
  function useFakeTimers() {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.useFakeTimers({ now: FAKE_NOW });
    });

    afterEach(() => {
      sandbox.restore();
    });
  }

  describe('isOlderThan', () => {
    it('returns false on recent and future timestamps', () => {
      assert.isFalse(isOlderThan(Date.now(), DAY));
      assert.isFalse(isOlderThan(Date.now() + DAY, DAY));
    });

    it('returns true on old enough timestamps', () => {
      assert.isFalse(isOlderThan(Date.now() - DAY + HOUR, DAY));
      assert.isTrue(isOlderThan(Date.now() - DAY - HOUR, DAY));
    });
  });

  describe('isMoreRecentThan', () => {
    it('returns true on recent and future timestamps', () => {
      assert.isTrue(isMoreRecentThan(Date.now(), DAY));
      assert.isTrue(isMoreRecentThan(Date.now() + DAY, DAY));
    });

    it('returns false on old enough timestamps', () => {
      assert.isTrue(isMoreRecentThan(Date.now() - DAY + HOUR, DAY));
      assert.isFalse(isMoreRecentThan(Date.now() - DAY - HOUR, DAY));
    });
  });

  describe('isSameDay', () => {
    it('returns false for different days', () => {
      assert.isFalse(
        isSameDay(
          new Date(1998, 10, 21, 12, 34, 56, 123),
          new Date(2006, 10, 21, 12, 34, 56, 123)
        )
      );
    });

    it('returns true for identical timestamps', () => {
      const timestamp = new Date(1998, 10, 21, 12, 34, 56, 123);
      assert.isTrue(isSameDay(timestamp, timestamp));
    });

    it('returns true for times on the same day', () => {
      assert.isTrue(
        isSameDay(
          new Date(1998, 10, 21, 12, 34, 56, 123),
          new Date(1998, 10, 21, 1, 23, 45, 123)
        )
      );
    });
  });

  describe('isToday', () => {
    useFakeTimers();

    it('returns false for days other than today', () => {
      assert.isFalse(isToday(Date.now() + DAY));
      assert.isFalse(isToday(Date.now() - DAY));
    });

    it('returns true right now', () => {
      assert.isTrue(isToday(Date.now()));
    });

    it('returns true for times today', () => {
      assert.isTrue(isToday(new Date('2020-01-23T03:56:00.000')));
    });
  });

  describe('toDayMillis', () => {
    const now = new Date();
    const today = new Date(toDayMillis(now.valueOf()));

    assert.strictEqual(today.getUTCMilliseconds(), 0);
    assert.strictEqual(today.getUTCHours(), 0);
    assert.strictEqual(today.getUTCMinutes(), 0);
    assert.strictEqual(today.getUTCSeconds(), 0);
    assert.strictEqual(today.getUTCDate(), now.getUTCDate());
    assert.strictEqual(today.getUTCMonth(), now.getUTCMonth());
    assert.strictEqual(today.getUTCFullYear(), now.getUTCFullYear());
  });
});
