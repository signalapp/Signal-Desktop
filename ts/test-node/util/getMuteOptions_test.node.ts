// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { DurationMs, MuteExpiration } from '@signalapp/types';
import i18n from './i18n.node.ts';

import type { MuteOption } from '../../util/getMuteOptions.std.ts';
import {
  getConversationMuteMenu,
  getMuteExpiration,
  getMuteOptions,
  getMuteValuesOptions,
} from '../../util/getMuteOptions.std.ts';

describe('getMuteOptions', () => {
  const NOW = new Date(2000, 3, 20, 12, 0, 0);

  const UNMUTE_OPTION: MuteOption = {
    name: 'Unmute',
    value: { type: 'unmute' },
  };

  const expectedAlwaysOption = (
    isCurrentlyMutedAlways = false
  ): MuteOption => ({
    name: 'Always',
    disabled: isCurrentlyMutedAlways,
    value: { type: 'always' },
  });

  const expectedDefaultOptions = ({
    isCurrentlyMutedAlways = false,
  }: { isCurrentlyMutedAlways?: boolean } = {}): Array<MuteOption> => [
    {
      name: '1 hour',
      value: { type: 'duration', durationMs: DurationMs.HOUR },
    },
    {
      name: '8 hours',
      value: { type: 'duration', durationMs: DurationMs.fromHours(8) },
    },
    {
      name: '1 day',
      value: { type: 'duration', durationMs: DurationMs.DAY },
    },
    {
      name: '1 week',
      value: { type: 'duration', durationMs: DurationMs.fromDays(7) },
    },
    {
      name: 'Until…',
      value: { type: 'custom' },
    },
    expectedAlwaysOption(isCurrentlyMutedAlways),
  ];

  const mutedUntil = (date: Date) => MuteExpiration.fromNumber(date.getTime());

  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getMuteValuesOptions', () => {
    it('returns the 6 default options', () => {
      assert.deepStrictEqual(
        getMuteValuesOptions(i18n),
        expectedDefaultOptions()
      );
    });

    it('disables "Always" when already muted always', () => {
      assert.deepStrictEqual(
        getMuteValuesOptions(i18n, { isCurrentlyMutedAlways: true }),
        expectedDefaultOptions({ isCurrentlyMutedAlways: true })
      );
    });

    it('returns only "Always" when that is the only allowed duration', () => {
      assert.deepStrictEqual(
        getMuteValuesOptions(i18n, { canOnlyBeMutedAlways: true }),
        [expectedAlwaysOption()]
      );
    });

    it('disables the only option when muted always and only "Always" is allowed', () => {
      assert.deepStrictEqual(
        getMuteValuesOptions(i18n, {
          canOnlyBeMutedAlways: true,
          isCurrentlyMutedAlways: true,
        }),
        [expectedAlwaysOption(true)]
      );
    });
  });

  describe('getMuteOptions', () => {
    describe('when not muted', () => {
      it('returns the default options with no "Unmute"', () => {
        assert.deepStrictEqual(
          getMuteOptions(undefined, i18n),
          expectedDefaultOptions()
        );
      });

      it('treats a null mute expiry as not muted', () => {
        assert.deepStrictEqual(
          getMuteOptions(null, i18n),
          expectedDefaultOptions()
        );
      });

      it('treats an expired mute as not muted', () => {
        assert.deepStrictEqual(
          getMuteOptions(mutedUntil(new Date(2000, 3, 20, 11, 0, 0)), i18n),
          expectedDefaultOptions()
        );
      });
    });

    describe('when muted', () => {
      it('returns an "Unmute" option, and then the default options', () => {
        assert.deepStrictEqual(
          getMuteOptions(mutedUntil(new Date(2000, 3, 20, 18, 30, 0)), i18n),
          [UNMUTE_OPTION, ...expectedDefaultOptions()]
        );
      });

      it('disables "Always" when muted always', () => {
        assert.deepStrictEqual(getMuteOptions(MuteExpiration.ALWAYS, i18n), [
          UNMUTE_OPTION,
          ...expectedDefaultOptions({ isCurrentlyMutedAlways: true }),
        ]);
      });

      it('returns "Unmute" and a disabled "Always" when only "Always" is allowed', () => {
        assert.deepStrictEqual(
          getMuteOptions(MuteExpiration.ALWAYS, i18n, {
            canOnlyBeMutedAlways: true,
          }),
          [UNMUTE_OPTION, expectedAlwaysOption(true)]
        );
      });
    });
  });

  describe('getConversationMuteMenu', () => {
    describe('when not muted', () => {
      it('returns the mute label and the default options', () => {
        assert.deepStrictEqual(getConversationMuteMenu(undefined, i18n), {
          label: 'Mute this chat for…',
          options: expectedDefaultOptions(),
        });
      });

      it('returns only "Always" when that is the only allowed duration', () => {
        assert.deepStrictEqual(
          getConversationMuteMenu(null, i18n, { canOnlyBeMutedAlways: true }),
          {
            label: 'Mute this chat for…',
            options: [expectedAlwaysOption()],
          }
        );
      });
    });

    describe('when muted', () => {
      it('returns a "Muted until" label and only an "Unmute" option', () => {
        assert.deepStrictEqual(
          getConversationMuteMenu(
            mutedUntil(new Date(2000, 3, 20, 18, 30, 0)),
            i18n
          ),
          {
            label: 'Muted until 6:30 PM',
            options: [UNMUTE_OPTION],
          }
        );
      });

      it("includes a date in the label if it's on a different day", () => {
        assert.deepStrictEqual(
          getConversationMuteMenu(
            mutedUntil(new Date(2000, 3, 21, 18, 30, 0)),
            i18n
          ).label,
          'Muted until 04/21/2000, 6:30 PM'
        );
      });

      it('returns a "Muted always" label when muted always', () => {
        assert.deepStrictEqual(
          getConversationMuteMenu(MuteExpiration.ALWAYS, i18n),
          {
            label: 'Muted always',
            options: [UNMUTE_OPTION],
          }
        );
      });
    });
  });

  it('getMuteExpiration', () => {
    assert.strictEqual(
      getMuteExpiration({ type: 'duration', durationMs: DurationMs.HOUR }),
      NOW.valueOf() + DurationMs.HOUR
    );
  });
});
