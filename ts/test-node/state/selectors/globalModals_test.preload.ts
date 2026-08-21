// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { StateType } from '../../../state/reducer.preload.ts';
import type { GlobalModalsStateType } from '../../../state/ducks/globalModals.preload.ts';
import { getEmptyState } from '../../../state/ducks/globalModals.preload.ts';

import { isShowingAnyModal } from '../../../state/selectors/globalModals.std.ts';
import { UsernameOnboardingState } from '../../../types/globalModals.std.ts';

describe('both/state/selectors/globalModals', () => {
  function getRootState(
    overrides: Readonly<Partial<GlobalModalsStateType>>
  ): StateType {
    return {
      globalModals: {
        ...getEmptyState(),
        ...overrides,
      },
    } as StateType;
  }

  describe('#isShowingAnyModal', () => {
    it('returns false in default state', () => {
      const state = getRootState({});
      assert.isFalse(isShowingAnyModal(state));
    });

    it('returns true when showing a modal', () => {
      const state = getRootState({
        errorModalProps: { title: 'hi', description: 'im a cat' },
      });
      assert.isTrue(isShowingAnyModal(state));
    });

    it('returns true when showing username megaphone', () => {
      const state = getRootState({
        usernameOnboardingState: UsernameOnboardingState.Open,
      });
      assert.isTrue(isShowingAnyModal(state));
    });
  });
});
