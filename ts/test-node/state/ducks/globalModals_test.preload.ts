// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  actions,
  getEmptyState,
  reducer,
} from '../../../state/ducks/globalModals.preload.js';

describe('both/state/ducks/globalModals', () => {
  describe('showWhatsNewModal/hideWhatsNewModal', () => {
    const { showWhatsNewModal, hideWhatsNewModal } = actions;

    it('toggles isWhatsNewVisible to true', () => {
      const state = getEmptyState();
      const nextState = reducer(state, showWhatsNewModal());

      assert.isTrue(nextState.isWhatsNewVisible);

      const nextNextState = reducer(nextState, hideWhatsNewModal());

      assert.isFalse(nextNextState.isWhatsNewVisible);
    });
  });
});
