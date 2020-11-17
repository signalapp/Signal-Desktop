// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { CallMode, CallState } from '../../../types/Calling';
import { getIncomingCall } from '../../../state/selectors/calling';
import { getEmptyState, CallingStateType } from '../../../state/ducks/calling';

describe('state/selectors/calling', () => {
  const stateWithDirectCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-direct-call-conversation-id': {
        callMode: CallMode.Direct,
        conversationId: 'fake-direct-call-conversation-id',
        callState: CallState.Accepted,
        isIncoming: false,
        isVideoCall: false,
        hasRemoteVideo: false,
      },
    },
  };

  const stateWithActiveDirectCall: CallingStateType = {
    ...stateWithDirectCall,
    activeCallState: {
      conversationId: 'fake-direct-call-conversation-id',
      hasLocalAudio: true,
      hasLocalVideo: false,
      showParticipantsList: false,
      pip: false,
      settingsDialogOpen: false,
    },
  };

  const stateWithIncomingDirectCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-direct-call-conversation-id': {
        callMode: CallMode.Direct,
        conversationId: 'fake-direct-call-conversation-id',
        callState: CallState.Ringing,
        isIncoming: true,
        isVideoCall: false,
        hasRemoteVideo: false,
      },
    },
  };

  describe('getIncomingCall', () => {
    it('returns undefined if there are no calls', () => {
      assert.isUndefined(getIncomingCall(getEmptyState()));
    });

    it('returns undefined if there is no incoming call', () => {
      assert.isUndefined(getIncomingCall(stateWithDirectCall));
      assert.isUndefined(getIncomingCall(stateWithActiveDirectCall));
    });

    it('returns the incoming call', () => {
      assert.deepEqual(getIncomingCall(stateWithIncomingDirectCall), {
        callMode: CallMode.Direct,
        conversationId: 'fake-direct-call-conversation-id',
        callState: CallState.Ringing,
        isIncoming: true,
        isVideoCall: false,
        hasRemoteVideo: false,
      });
    });
  });
});
