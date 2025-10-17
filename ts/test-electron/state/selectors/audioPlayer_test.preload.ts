// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { noopAction } from '../../../state/ducks/noop.std.js';
import type { VoiceNoteAndConsecutiveForPlayback } from '../../../state/selectors/audioPlayer.preload.js';
import { isPaused } from '../../../state/selectors/audioPlayer.preload.js';
import { actions } from '../../../state/ducks/audioPlayer.preload.js';
import type { StateType } from '../../../state/reducer.preload.js';
import { reducer as rootReducer } from '../../../state/reducer.preload.js';

function voiceNoteDataForMessage(
  messageId: string
): VoiceNoteAndConsecutiveForPlayback {
  return {
    conversationId: 'convo',
    voiceNote: {
      id: messageId,
      type: 'outgoing',
      timestamp: 0,
      url: undefined,
      source: undefined,
      sourceServiceId: undefined,
      messageIdForLogging: messageId,
      isPlayed: false,
    },
    consecutiveVoiceNotes: [],
    previousMessageId: undefined,
    nextMessageTimestamp: undefined,
    playbackRate: 1,
  };
}

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

      const updated = rootReducer(
        state,
        actions.loadVoiceNoteAudio({
          voiceNoteData: voiceNoteDataForMessage('id'),
          position: 0,
          context: 'context',
          ourConversationId: 'convo',
          playbackRate: 1,
        })
      );

      assert.isFalse(isPaused(updated));
    });
  });
});
