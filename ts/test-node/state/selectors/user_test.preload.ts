// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { StateType } from '../../../state/reducer.preload.js';
import type { UserStateType } from '../../../state/ducks/user.preload.js';
import { getEmptyState } from '../../../state/ducks/user.preload.js';

import { getIsNightly, getIsBeta } from '../../../state/selectors/user.std.js';

describe('both/state/selectors/user', () => {
  function getRootState(
    overrides: Readonly<Partial<UserStateType>>
  ): StateType {
    return {
      user: {
        ...getEmptyState(),
        ...overrides,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  describe('#getIsNightly', () => {
    it('returns false for beta', () => {
      const state = getRootState({ version: '1.23.4-beta.5' });
      assert.isFalse(getIsNightly(state));
    });

    it('returns false for production', () => {
      const state = getRootState({ version: '1.23.4' });
      assert.isFalse(getIsNightly(state));
    });

    it('returns true for alpha', () => {
      const state = getRootState({ version: '1.23.4-alpha.987' });
      assert.isTrue(getIsNightly(state));
    });
  });

  describe('#getIsBeta', () => {
    it('returns false for alpha', () => {
      const state = getRootState({ version: '1.23.4-alpha.987' });
      assert.isFalse(getIsBeta(state));
    });

    it('returns false for production', () => {
      const state = getRootState({ version: '1.23.4' });
      assert.isFalse(getIsBeta(state));
    });

    it('returns true for beta', () => {
      const state = getRootState({ version: '1.23.4-beta.5' });
      assert.isTrue(getIsBeta(state));
    });
  });
});
