// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { SetMessageAudioAction } from '../../../state/ducks/audioPlayer';
import type { SelectedConversationChangedActionType } from '../../../state/ducks/conversations';
import {
  SELECTED_CONVERSATION_CHANGED,
  actions as conversationsActions,
} from '../../../state/ducks/conversations';
import { noopAction } from '../../../state/ducks/noop';

import type { StateType } from '../../../state/reducer';
import { reducer as rootReducer } from '../../../state/reducer';

const { messageDeleted, messageChanged } = conversationsActions;

const MESSAGE_ID = 'message-id';

// can't use the actual action since it's a ThunkAction
const setMessageAudio = (
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

describe('both/state/ducks/audioPlayer', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  const getInitializedState = (): StateType => {
    const state = getEmptyRootState();
    const updated = rootReducer(state, setMessageAudio(MESSAGE_ID, 'context'));

    assert.strictEqual(updated.audioPlayer.active?.id, MESSAGE_ID);
    assert.strictEqual(updated.audioPlayer.active?.context, 'context');

    return updated;
  };

  describe('setActiveAudioID', () => {
    it("updates `activeAudioID` in the audioPlayer's state", () => {
      const state = getEmptyRootState();
      assert.strictEqual(state.audioPlayer.active, undefined);

      const updated = rootReducer(state, setMessageAudio('test', 'context'));
      assert.strictEqual(updated.audioPlayer.active?.id, 'test');
      assert.strictEqual(updated.audioPlayer.active?.context, 'context');
    });
  });

  it('resets activeAudioID when changing the conversation', () => {
    const state = getInitializedState();

    const updated = rootReducer(state, <SelectedConversationChangedActionType>{
      type: SELECTED_CONVERSATION_CHANGED,
      payload: { id: 'any' },
    });

    assert.strictEqual(updated.audioPlayer.active, undefined);
  });

  it('resets activeAudioID when message was deleted', () => {
    const state = getInitializedState();

    const updated = rootReducer(
      state,
      messageDeleted(MESSAGE_ID, 'conversation-id')
    );

    assert.strictEqual(updated.audioPlayer.active, undefined);
  });

  it('resets activeAudioID when message was erased', () => {
    const state = getInitializedState();

    const updated = rootReducer(
      state,
      messageChanged(MESSAGE_ID, 'conversation-id', {
        id: MESSAGE_ID,
        type: 'incoming',
        sent_at: 1,
        received_at: 1,
        timestamp: 1,
        conversationId: 'conversation-id',

        deletedForEveryone: true,
      })
    );

    assert.strictEqual(updated.audioPlayer.active, undefined);
  });
});
