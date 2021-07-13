// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  actions,
  getEmptyState,
  reducer,
} from '../../../state/ducks/globalModals';

describe('both/state/ducks/globalModals', () => {
  describe('toggleChatColorEditor', () => {
    const { toggleChatColorEditor } = actions;

    it('toggles isChatColorEditorVisible', () => {
      const state = getEmptyState();
      const nextState = reducer(state, toggleChatColorEditor());

      assert.isTrue(nextState.isChatColorEditorVisible);

      const nextNextState = reducer(nextState, toggleChatColorEditor());

      assert.isFalse(nextNextState.isChatColorEditorVisible);
    });
  });
});
