// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import { CallMode, CallState } from '../../../types/Calling';
import {
  getCallsByConversation,
  getCallSelector,
  getIncomingCall,
} from '../../../state/selectors/calling';
import { getEmptyState, CallingStateType } from '../../../state/ducks/calling';

describe('state/selectors/calling', () => {
  const getEmptyRootState = () => rootReducer(undefined, noopAction());

  const getCallingState = (calling: CallingStateType) => ({
    ...getEmptyRootState(),
    calling,
  });

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
      safetyNumberChangedUuids: [],
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

  describe('getCallsByConversation', () => {
    it('returns state.calling.callsByConversation', () => {
      assert.deepEqual(getCallsByConversation(getEmptyRootState()), {});

      assert.deepEqual(
        getCallsByConversation(getCallingState(stateWithDirectCall)),
        {
          'fake-direct-call-conversation-id': {
            callMode: CallMode.Direct,
            conversationId: 'fake-direct-call-conversation-id',
            callState: CallState.Accepted,
            isIncoming: false,
            isVideoCall: false,
            hasRemoteVideo: false,
          },
        }
      );
    });
  });

  describe('getCallSelector', () => {
    it('returns a selector that returns undefined if selecting a conversation with no call', () => {
      assert.isUndefined(
        getCallSelector(getEmptyRootState())('conversation-id')
      );
    });

    it("returns a selector that returns a conversation's call", () => {
      assert.deepEqual(
        getCallSelector(getCallingState(stateWithDirectCall))(
          'fake-direct-call-conversation-id'
        ),
        {
          callMode: CallMode.Direct,
          conversationId: 'fake-direct-call-conversation-id',
          callState: CallState.Accepted,
          isIncoming: false,
          isVideoCall: false,
          hasRemoteVideo: false,
        }
      );
    });
  });

  describe('getIncomingCall', () => {
    it('returns undefined if there are no calls', () => {
      assert.isUndefined(getIncomingCall(getEmptyRootState()));
    });

    it('returns undefined if there is no incoming call', () => {
      assert.isUndefined(getIncomingCall(getCallingState(stateWithDirectCall)));
      assert.isUndefined(
        getIncomingCall(getCallingState(stateWithActiveDirectCall))
      );
    });

    it('returns the incoming call', () => {
      assert.deepEqual(
        getIncomingCall(getCallingState(stateWithIncomingDirectCall)),
        {
          callMode: CallMode.Direct,
          conversationId: 'fake-direct-call-conversation-id',
          callState: CallState.Ringing,
          isIncoming: true,
          isVideoCall: false,
          hasRemoteVideo: false,
        }
      );
    });
  });
});
