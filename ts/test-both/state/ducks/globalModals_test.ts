// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  actions,
  getEmptyState,
  reducer,
} from '../../../state/ducks/globalModals';

describe('both/state/ducks/globalModals', () => {
  describe('toggleProfileEditor', () => {
    const { toggleProfileEditor } = actions;

    it('toggles isProfileEditorVisible', () => {
      const state = getEmptyState();
      const nextState = reducer(state, toggleProfileEditor());

      assert.isTrue(nextState.isProfileEditorVisible);

      const nextNextState = reducer(nextState, toggleProfileEditor());

      assert.isFalse(nextNextState.isProfileEditorVisible);
    });
  });
});
