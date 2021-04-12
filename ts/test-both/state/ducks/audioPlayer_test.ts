// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { actions } from '../../../state/ducks/audioPlayer';
import { noopAction } from '../../../state/ducks/noop';

import { StateType, reducer as rootReducer } from '../../../state/reducer';

describe('both/state/ducks/audioPlayer', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  describe('setActiveAudioID', () => {
    it("updates `activeAudioID` in the audioPlayer's state", () => {
      const state = getEmptyRootState();
      assert.strictEqual(state.audioPlayer.activeAudioID, undefined);

      const updated = rootReducer(state, actions.setActiveAudioID('test'));
      assert.strictEqual(updated.audioPlayer.activeAudioID, 'test');
    });
  });
});
