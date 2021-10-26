// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { actions } from '../../../state/ducks/audioPlayer';
import { noopAction } from '../../../state/ducks/noop';
import { isPaused } from '../../../state/selectors/audioPlayer';
import type { StateType } from '../../../state/reducer';
import { reducer as rootReducer } from '../../../state/reducer';

describe('state/selectors/audioPlayer', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  describe('isPaused', () => {
    it('returns true if state.audioPlayer.activeAudioID is undefined', () => {
      const state = getEmptyRootState();
      assert.isTrue(isPaused(state));
    });

    it('returns false if state.audioPlayer.activeAudioID is not undefined', () => {
      const state = getEmptyRootState();

      const updated = rootReducer(
        state,
        actions.setActiveAudioID('id', 'context')
      );

      assert.isFalse(isPaused(updated));
    });
  });
});
