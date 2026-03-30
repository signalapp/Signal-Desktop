// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { StateType } from '../../../state/reducer.preload.ts';
import type { UserStateType } from '../../../state/ducks/user.preload.ts';
import { getEmptyState } from '../../../state/ducks/user.preload.ts';

import { getIsNightly, getIsBeta } from '../../../state/selectors/user.std.ts';

describe('both/state/selectors/user', () => {
  function getRootState(
    overrides: Readonly<Partial<UserStateType>>
  ): StateType {
    return {
      user: {
        ...getEmptyState(),
        ...overrides,
      },
      // oxlint-disable-next-line typescript/no-explicit-any
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
