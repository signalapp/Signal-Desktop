// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { CallState } from '../../../types/Calling';
import {
  getIncomingCall,
  getActiveCall,
  isCallActive,
} from '../../../state/selectors/calling';
import { getEmptyState } from '../../../state/ducks/calling';

describe('state/selectors/calling', () => {
  const stateWithDirectCall = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-direct-call-conversation-id': {
        conversationId: 'fake-direct-call-conversation-id',
        callState: CallState.Accepted,
        isIncoming: false,
        isVideoCall: false,
        hasRemoteVideo: false,
      },
    },
  };

  const stateWithActiveDirectCall = {
    ...stateWithDirectCall,
    activeCallState: {
      conversationId: 'fake-direct-call-conversation-id',
      hasLocalAudio: true,
      hasLocalVideo: false,
      participantsList: false,
      pip: false,
      settingsDialogOpen: false,
    },
  };

  const stateWithIncomingDirectCall = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-direct-call-conversation-id': {
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
        conversationId: 'fake-direct-call-conversation-id',
        callState: CallState.Ringing,
        isIncoming: true,
        isVideoCall: false,
        hasRemoteVideo: false,
      });
    });
  });

  describe('getActiveCall', () => {
    it('returns undefined if there are no calls', () => {
      assert.isUndefined(getActiveCall(getEmptyState()));
    });

    it('returns undefined if there is no active call', () => {
      assert.isUndefined(getActiveCall(stateWithDirectCall));
    });

    it('returns the active call', () => {
      assert.deepEqual(getActiveCall(stateWithActiveDirectCall), {
        conversationId: 'fake-direct-call-conversation-id',
        callState: CallState.Accepted,
        isIncoming: false,
        isVideoCall: false,
        hasRemoteVideo: false,
      });
    });
  });

  describe('isCallActive', () => {
    it('returns false if there are no calls', () => {
      assert.isFalse(isCallActive(getEmptyState()));
    });

    it('returns false if there is no active call', () => {
      assert.isFalse(isCallActive(stateWithDirectCall));
    });

    it('returns true if there is an active call', () => {
      assert.isTrue(isCallActive(stateWithActiveDirectCall));
    });
  });
});
