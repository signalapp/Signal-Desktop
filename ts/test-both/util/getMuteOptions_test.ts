// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

import { getMuteOptions } from '../../util/getMuteOptions';

describe('getMuteOptions', () => {
  const HOUR = 3600000;
  const DAY = HOUR * 24;
  const WEEK = DAY * 7;
  const EXPECTED_DEFAULT_OPTIONS = [
    {
      name: 'Mute for one hour',
      value: HOUR,
    },
    {
      name: 'Mute for eight hours',
      value: HOUR * 8,
    },
    {
      name: 'Mute for one day',
      value: DAY,
    },
    {
      name: 'Mute for one week',
      value: WEEK,
    },
    {
      name: 'Mute always',
      value: Number.MAX_SAFE_INTEGER,
    },
  ];

  const i18n = setupI18n('en', enMessages);

  describe('when not muted', () => {
    it('returns the 5 default options', () => {
      assert.deepStrictEqual(
        getMuteOptions(undefined, i18n),
        EXPECTED_DEFAULT_OPTIONS
      );
    });
  });

  describe('when muted', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.useFakeTimers({
        now: new Date(2000, 3, 20, 12, 0, 0),
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('returns a current mute label, an "Unmute" option, and then the 5 default options', () => {
      assert.deepStrictEqual(
        getMuteOptions(new Date(2000, 3, 20, 18, 30, 0).valueOf(), i18n),
        [
          {
            disabled: true,
            name: 'Muted until 6:30 PM',
            value: -1,
          },
          {
            name: 'Unmute',
            value: 0,
          },
          ...EXPECTED_DEFAULT_OPTIONS,
        ]
      );
    });

    it("renders the current mute label with a date if it's on a different day", () => {
      assert.deepStrictEqual(
        getMuteOptions(new Date(2000, 3, 21, 18, 30, 0).valueOf(), i18n)[0],
        {
          disabled: true,
          name: 'Muted until 04/21/2000, 6:30 PM',
          value: -1,
        }
      );
    });
  });
});
