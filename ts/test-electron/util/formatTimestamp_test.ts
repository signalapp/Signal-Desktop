// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import moment from 'moment';
import {
  formatTimestamp,
  formatDate,
  formatDateTimeLong,
  formatDateTimeShort,
  formatTime,
} from '../../util/formatTimestamp.dom.js';
import { HourCyclePreference } from '../../types/I18N.std.js';
import i18n from '../../test-node/util/i18n.node.js';

const min = new Date(2023, 0, 1, 0).getTime();
const max = new Date(2023, 0, 1, 23).getTime();

const FAKE_NOW = new Date('2020-01-23T04:56:00.000');

describe('formatTimestamp', () => {
  let sandbox: sinon.SinonSandbox;
  let localesStub: sinon.SinonStub;
  let localeOverrideStub: sinon.SinonStub;
  let hourCycleStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.useFakeTimers({ now: FAKE_NOW });
    localesStub = sandbox.stub(
      window.SignalContext,
      'getPreferredSystemLocales'
    );
    localeOverrideStub = sandbox.stub(
      window.SignalContext,
      'getLocaleOverride'
    );
    hourCycleStub = sandbox.stub(
      window.SignalContext,
      'getHourCyclePreference'
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  function testCase(
    locale: string,
    preference: HourCyclePreference,
    time: number,
    expected: string
  ) {
    const timeFmt = new Intl.DateTimeFormat('en', {
      timeStyle: 'medium',
    }).format(time);
    it(`should format with locale: ${locale} (${HourCyclePreference[preference]}) @ ${timeFmt})`, () => {
      localesStub.returns([locale]);
      localeOverrideStub.returns(null);
      hourCycleStub.returns(preference);
      assert.equal(formatTimestamp(time, { timeStyle: 'medium' }), expected);
    });
  }

  testCase('en', HourCyclePreference.UnknownPreference, min, '12:00:00 AM');
  testCase('en', HourCyclePreference.UnknownPreference, max, '11:00:00 PM');
  testCase('en', HourCyclePreference.Prefer12, min, '12:00:00 AM');
  testCase('en', HourCyclePreference.Prefer12, max, '11:00:00 PM');
  testCase('en', HourCyclePreference.Prefer24, min, '00:00:00');
  testCase('en', HourCyclePreference.Prefer24, max, '23:00:00');

  testCase('nb', HourCyclePreference.UnknownPreference, min, '00:00:00');
  testCase('nb', HourCyclePreference.UnknownPreference, max, '23:00:00');
  testCase('nb', HourCyclePreference.Prefer12, min, '12:00:00 a.m.');
  testCase('nb', HourCyclePreference.Prefer12, max, '11:00:00 p.m.');
  testCase('nb', HourCyclePreference.Prefer24, min, '00:00:00');
  testCase('nb', HourCyclePreference.Prefer24, max, '23:00:00');

  testCase('ja', HourCyclePreference.UnknownPreference, min, '0:00:00');
  testCase('ja', HourCyclePreference.UnknownPreference, max, '23:00:00');
  testCase('ja', HourCyclePreference.Prefer12, min, '午前0:00:00');
  testCase('ja', HourCyclePreference.Prefer12, max, '午後11:00:00');
  testCase('ja', HourCyclePreference.Prefer24, min, '0:00:00');
  testCase('ja', HourCyclePreference.Prefer24, max, '23:00:00');

  describe('formatDate', () => {
    beforeEach(() => {
      localesStub.returns(['en']);
    });

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
      assert.include(result, m.format('ddd'));
      assert.include(result, m.format('MMM'));
      assert.include(result, m.format('D'));
      assert.notInclude(result, m.format('YYYY'));
    });

    it('returns a formatted timestamp for dates older than six months', () => {
      assert.strictEqual(formatDate(i18n, moment('2017-03-03')), 'Mar 3, 2017');
    });
  });

  describe('formatDateTimeLong', () => {
    beforeEach(() => {
      localesStub.returns(['en']);
    });

    it('includes "Today" and the time for times today', () => {
      const rx = /Today \d+:\d+ [A|P]M/;
      const datetime = formatDateTimeLong(i18n, FAKE_NOW);
      assert.isTrue(rx.test(datetime));
    });

    it('includes "Yesterday" and the time for times yesterday', () => {
      const rx = /Yesterday \d+:\d+ [A|P]M/;
      const datetime = formatDateTimeLong(i18n, moment().subtract(1, 'day'));
      assert.isTrue(rx.test(datetime));
    });

    it('formats month name, day of month, year, and time for other times', () => {
      const rx = /Apr (19|20|21), 2000, \d+:\d+ [A|P]M/;
      const datetime = formatDateTimeLong(i18n, new Date(956216013000));
      assert.isTrue(rx.test(datetime));
    });
  });

  describe('formatDateTimeShort', () => {
    beforeEach(() => {
      localesStub.returns(['en']);
    });

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
      const rx = /\d+:\d+ [A|P]M/;
      const datetime = formatDateTimeLong(i18n, oneHourAgo);
      assert.isTrue(rx.test(datetime));
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
    beforeEach(() => {
      localesStub.returns(['en']);
    });

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
      const rx = /\d+:\d+ [A|P]M/;
      const oneHourAgo = new Date('2020-01-23T03:56:00.000');
      assert.isTrue(rx.test(formatTime(i18n, oneHourAgo, FAKE_NOW)));

      const oneDayAgo = new Date('2020-01-22T04:56:00.000');
      assert.isTrue(rx.test(formatTime(i18n, oneDayAgo, FAKE_NOW)));

      const oneYearAgo = new Date('2019-01-23T04:56:00.000');
      assert.isTrue(rx.test(formatTime(i18n, oneYearAgo, FAKE_NOW)));
    });
  });
});
