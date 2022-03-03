// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import moment from 'moment';
import type { LocalizerType } from '../../types/Util';
import { HOUR, DAY } from '../../util/durations';

import {
  formatDate,
  formatDateTimeLong,
  formatDateTimeShort,
  formatTime,
  isMoreRecentThan,
  isOlderThan,
  isSameDay,
  isToday,
  toDayMillis,
} from '../../util/timestamp';

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

  const i18n = ((key: string, values: Array<string> = []): string => {
    switch (key) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'TimelineDateHeader--date-in-last-6-months':
        return '[short] ddd, MMM D';
      case 'TimelineDateHeader--date-older-than-6-months':
        return '[long] MMM D, YYYY';
      case 'timestampFormat__long__today':
        return '[Today] LT';
      case 'timestampFormat__long__yesterday':
        return '[Yesterday] LT';
      case 'justNow':
        return 'Now';
      case 'minutesAgo':
        return `${values[0]}m`;
      case 'timestampFormat_M':
        return 'MMM D';
      default:
        throw new Error(`Unexpected key ${key}`);
    }
  }) as LocalizerType;

  describe('formatDate', () => {
    useFakeTimers();

    it('returns "Today" for times today', () => {
      [moment(), moment().endOf('day'), moment().startOf('day')].forEach(m => {
        assert.strictEqual(formatDate(i18n, m), 'Today');
      });
    });

    it('returns "Yesterday" for times yesterday', () => {
      const minus24Hours = moment().subtract(1, 'day');
      [
        minus24Hours,
        minus24Hours.clone().endOf('day'),
        minus24Hours.clone().startOf('day'),
      ].forEach(m => {
        assert.strictEqual(formatDate(i18n, m), 'Yesterday');
      });
    });

    it('returns a formatted timestamp for dates more recent than six months', () => {
      const m = moment().subtract(2, 'months');
      const result = formatDate(i18n, m);
      assert.include(result, 'short');
      assert.include(result, m.format('ddd'));
      assert.include(result, m.format('MMM'));
      assert.include(result, m.format('D'));
      assert.notInclude(result, m.format('YYYY'));
    });

    it('returns a formatted timestamp for dates older than six months', () => {
      assert.strictEqual(
        formatDate(i18n, moment('2017-03-03')),
        'long Mar 3, 2017'
      );
    });

    it('returns a formatted timestamp if the i18n strings are too long', () => {
      const longI18n = ((_: string) =>
        Array(50).fill('MMM').join(' ')) as LocalizerType;
      assert.include(formatDate(longI18n, moment('2017-03-03')), '2017');
    });
  });

  describe('formatDateTimeLong', () => {
    useFakeTimers();

    it('includes "Today" and the time for times today', () => {
      assert.strictEqual(formatDateTimeLong(i18n, FAKE_NOW), 'Today 4:56 AM');
    });

    it('includes "Yesterday" and the time for times yesterday', () => {
      assert.strictEqual(
        formatDateTimeLong(i18n, moment().subtract(1, 'day')),
        'Yesterday 4:56 AM'
      );
    });

    it('formats month name, day of month, year, and time for other times', () => {
      [
        moment().add(1, 'week'),
        moment().subtract(1, 'week'),
        moment().subtract(1, 'year'),
      ].forEach(timestamp => {
        assert.strictEqual(
          formatDateTimeLong(i18n, timestamp),
          moment(timestamp).format('lll')
        );
      });
    });
  });

  describe('formatDateTimeShort', () => {
    useFakeTimers();

    it('returns "Now" for times within the last minute, including unexpected times in the future', () => {
      [
        Date.now(),
        moment().subtract(1, 'second'),
        moment().subtract(59, 'seconds'),
        moment().add(1, 'minute'),
        moment().add(1, 'year'),
      ].forEach(timestamp => {
        assert.strictEqual(formatDateTimeShort(i18n, timestamp), 'Now');
      });
    });

    it('returns "X minutes ago" for times in the last hour, but older than 1 minute', () => {
      assert.strictEqual(
        formatDateTimeShort(i18n, moment().subtract(1, 'minute')),
        '1m'
      );
      assert.strictEqual(
        formatDateTimeShort(i18n, moment().subtract(30, 'minutes')),
        '30m'
      );
      assert.strictEqual(
        formatDateTimeShort(i18n, moment().subtract(59, 'minutes')),
        '59m'
      );
    });

    it('returns hh:mm-like times for times older than 1 hour from now, but still today', () => {
      const oneHourAgo = new Date('2020-01-23T03:56:00.000');
      assert.deepEqual(formatDateTimeShort(i18n, oneHourAgo), '3:56 AM');
    });

    it('returns the day of the week for dates in the last week, but still this month', () => {
      const yesterday = new Date('2020-01-22T23:56:00.000');
      assert.deepEqual(formatDateTimeShort(i18n, yesterday), 'Wed');

      const twoDaysAgo = new Date('2020-01-21T05:56:00.000');
      assert.deepEqual(formatDateTimeShort(i18n, twoDaysAgo), 'Tue');
    });

    it('returns the month and day for dates older than this week, but still this year', () => {
      const earlier = new Date('2020-01-03T04:56:00.000');
      assert.deepEqual(formatDateTimeShort(i18n, earlier), 'Jan 3');
    });

    it('returns the year, month, and day for dates older than a year ago', () => {
      const longAgo = new Date('1998-11-23T12:34:00.000');
      assert.deepEqual(formatDateTimeShort(i18n, longAgo), 'Nov 23, 1998');
    });
  });

  describe('formatTime', () => {
    it('returns "Now" for times within the last minute, including unexpected times in the future', () => {
      [
        FAKE_NOW,
        moment(FAKE_NOW).subtract(1, 'second'),
        moment(FAKE_NOW).subtract(59, 'seconds'),
        moment(FAKE_NOW).add(1, 'minute'),
        moment(FAKE_NOW).add(1, 'year'),
      ].forEach(timestamp => {
        assert.strictEqual(formatTime(i18n, timestamp, FAKE_NOW), 'Now');
      });
    });

    it('returns "X minutes ago" for times in the last hour, but older than 1 minute', () => {
      assert.strictEqual(
        formatTime(i18n, moment(FAKE_NOW).subtract(1, 'minute'), FAKE_NOW),
        '1m'
      );
      assert.strictEqual(
        formatTime(i18n, moment(FAKE_NOW).subtract(30, 'minutes'), FAKE_NOW),
        '30m'
      );
      assert.strictEqual(
        formatTime(i18n, moment(FAKE_NOW).subtract(59, 'minutes'), FAKE_NOW),
        '59m'
      );
    });

    it('returns hh:mm-like times for times older than 1 hour from now', () => {
      const oneHourAgo = new Date('2020-01-23T03:56:00.000');
      assert.deepEqual(formatTime(i18n, oneHourAgo, FAKE_NOW), '3:56 AM');

      const oneDayAgo = new Date('2020-01-22T04:56:00.000');
      assert.deepEqual(formatTime(i18n, oneDayAgo, FAKE_NOW), '4:56 AM');

      const oneYearAgo = new Date('2019-01-23T04:56:00.000');
      assert.deepEqual(formatTime(i18n, oneYearAgo, FAKE_NOW), '4:56 AM');
    });
  });

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
