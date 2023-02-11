// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { SetMessageAudioAction } from '../../../state/ducks/audioPlayer';
import { noopAction } from '../../../state/ducks/noop';
import { isPaused } from '../../../state/selectors/audioPlayer';
import type { StateType } from '../../../state/reducer';
import { reducer as rootReducer } from '../../../state/reducer';

// can't use the actual action since it's a ThunkAction
const setActiveAudioID = (
  id: string,
  context: string
): SetMessageAudioAction => ({
  type: 'audioPlayer/SET_MESSAGE_AUDIO',
  payload: {
    id,
    context,
    playbackRate: 1,
    duration: 100,
  },
});

describe('state/selectors/audioPlayer', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  describe('isPaused', () => {
    it('returns true if state.audioPlayer.active is undefined', () => {
      const state = getEmptyRootState();
      assert.isTrue(isPaused(state));
    });

    it('returns false if state.audioPlayer.active is not undefined', () => {
      const state = getEmptyRootState();

      const updated = rootReducer(state, setActiveAudioID('id', 'context'));

      assert.isFalse(isPaused(updated));
    });
  });
});
