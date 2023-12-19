// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { formatTimestamp } from '../../util/formatTimestamp';
import { HourCyclePreference } from '../../types/I18N';

const min = new Date(2023, 0, 1, 0).getTime();
const max = new Date(2023, 0, 1, 23).getTime();

describe('formatTimestamp', () => {
  let sandbox: sinon.SinonSandbox;
  let localesStub: sinon.SinonStub;
  let localeOverrideStub: sinon.SinonStub;
  let hourCycleStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
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
});
