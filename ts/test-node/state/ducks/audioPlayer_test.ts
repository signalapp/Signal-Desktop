// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { TargetedConversationChangedActionType } from '../../../state/ducks/conversations.preload.js';
import {
  TARGETED_CONVERSATION_CHANGED,
  actions as conversationsActions,
} from '../../../state/ducks/conversations.preload.js';
import { noopAction } from '../../../state/ducks/noop.std.js';

import type { StateType } from '../../../state/reducer.preload.js';
import { reducer as rootReducer } from '../../../state/reducer.preload.js';
import {
  actions,
  AudioPlayerContent,
} from '../../../state/ducks/audioPlayer.preload.js';
import type { VoiceNoteAndConsecutiveForPlayback } from '../../../state/selectors/audioPlayer.preload.js';

const { messageDeleted, messageChanged } = conversationsActions;

const MESSAGE_ID = 'message-id';

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

describe('both/state/ducks/audioPlayer', () => {
  const getEmptyRootState = (): StateType => {
    return rootReducer(undefined, noopAction());
  };

  const getInitializedState = (): StateType => {
    const state = getEmptyRootState();
    const updated = rootReducer(
      state,
      actions.loadVoiceNoteAudio({
        voiceNoteData: voiceNoteDataForMessage(MESSAGE_ID),
        position: 0,
        context: 'context',
        ourConversationId: 'convo',
        playbackRate: 1,
      })
    );

    const content = updated.audioPlayer.active?.content;

    assert.isTrue(content && AudioPlayerContent.isVoiceNote(content));

    if (content && AudioPlayerContent.isVoiceNote(content)) {
      assert.strictEqual(content.current.id, MESSAGE_ID);
      assert.strictEqual(content.context, 'context');
    }

    return updated;
  };

  describe('loadMessageAudio', () => {
    it("updates `active` in the audioPlayer's state", () => {
      const state = getEmptyRootState();
      assert.strictEqual(state.audioPlayer.active, undefined);

      const updated = rootReducer(
        state,
        actions.loadVoiceNoteAudio({
          voiceNoteData: voiceNoteDataForMessage('test'),
          position: 0,
          context: 'context',
          ourConversationId: 'convo',
          playbackRate: 1,
        })
      );

      const content = updated.audioPlayer.active?.content;
      assert.isTrue(content && AudioPlayerContent.isVoiceNote(content));

      if (content && AudioPlayerContent.isVoiceNote(content)) {
        assert.strictEqual(content.current.id, 'test');
        assert.strictEqual(content.context, 'context');
      }
    });
  });

  it('active is not changed when changing the conversation', () => {
    const state = getInitializedState();

    const action: TargetedConversationChangedActionType = {
      type: TARGETED_CONVERSATION_CHANGED,
      payload: { conversationId: 'any' },
    };
    const updated = rootReducer(state, action);

    const content = updated.audioPlayer.active?.content;
    assert.isTrue(content && AudioPlayerContent.isVoiceNote(content));

    if (content && AudioPlayerContent.isVoiceNote(content)) {
      assert.strictEqual(content.current.id, MESSAGE_ID);
    }
  });

  it('resets active.content when message was deleted', () => {
    const state = getInitializedState();

    const updated = rootReducer(
      state,
      messageDeleted(MESSAGE_ID, 'conversation-id')
    );

    assert.strictEqual(updated.audioPlayer.active?.content, undefined);
  });

  it('resets active.content when message is DOE', () => {
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

    assert.strictEqual(updated.audioPlayer.active?.content, undefined);
  });
});
