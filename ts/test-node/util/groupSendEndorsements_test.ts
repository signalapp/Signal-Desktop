// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import assert from 'node:assert/strict';
import { validateGroupSendEndorsementsExpiration } from '../../util/groupSendEndorsements';
import { DAY, HOUR, SECOND } from '../../util/durations';

describe('groupSendEndorsements', () => {
  describe('validateGroupSendEndorsementsExpiration', () => {
    function validateDistance(distance: number) {
      const now = Date.now();
      const expiration = now + distance;
      return validateGroupSendEndorsementsExpiration(expiration, now);
    }

    function checkValid(label: string, distance: number) {
      it(label, () => {
        const actual = validateDistance(distance);
        assert.equal(actual.valid, true);
        assert.equal(actual.reason, undefined);
      });
    }

    function checkInvalid(label: string, distance: number, reason: RegExp) {
      it(label, () => {
        const actual = validateDistance(distance);
        assert.equal(actual.valid, false);
        assert.match(actual.reason, reason);
      });
    }

    const TWO_HOURS = HOUR * 2;
    const TWO_DAYS = DAY * 2;

    checkInvalid('2d ago', -TWO_DAYS, /already expired/);
    checkInvalid('2h ago', -TWO_HOURS, /already expired/);
    checkInvalid('1s ago', -SECOND, /already expired/);
    checkInvalid('now', 0, /already expired/);
    checkInvalid('in 1s', SECOND, /expires soon/);
    checkInvalid('in <2h', TWO_HOURS - SECOND, /expires soon/);
    checkInvalid('in 2h', TWO_HOURS, /expires soon/);
    checkValid('in >2h', TWO_HOURS + SECOND);
    checkValid('in <2d', TWO_DAYS - SECOND);
    checkInvalid('in 2d', TWO_DAYS, /expires too far in future/);
    checkInvalid('in >2d', TWO_DAYS + SECOND, /expires too far in future/);
  });
});
