// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import { actions, getEmptyState, reducer } from '../../../state/ducks/calling';
import { calling as callingService } from '../../../services/calling';
import { CallState } from '../../../types/Calling';

describe('calling duck', () => {
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

  const getEmptyRootState = () => rootReducer(undefined, noopAction());

  beforeEach(function beforeEach() {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function afterEach() {
    this.sandbox.restore();
  });

  describe('actions', () => {
    describe('acceptCall', () => {
      const { acceptCall } = actions;

      beforeEach(function beforeEach() {
        this.callingServiceAccept = this.sandbox
          .stub(callingService, 'accept')
          .resolves();
      });

      it('dispatches an ACCEPT_CALL_PENDING action', async () => {
        const dispatch = sinon.spy();

        await acceptCall({
          conversationId: '123',
          asVideoCall: true,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/ACCEPT_CALL_PENDING',
          payload: {
            conversationId: '123',
            asVideoCall: true,
          },
        });

        await acceptCall({
          conversationId: '456',
          asVideoCall: false,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledTwice(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/ACCEPT_CALL_PENDING',
          payload: {
            conversationId: '456',
            asVideoCall: false,
          },
        });
      });

      it('asks the calling service to accept the call', async function test() {
        const dispatch = sinon.spy();

        await acceptCall({
          conversationId: '123',
          asVideoCall: true,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(this.callingServiceAccept);
        sinon.assert.calledWith(this.callingServiceAccept, '123', true);

        await acceptCall({
          conversationId: '456',
          asVideoCall: false,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledTwice(this.callingServiceAccept);
        sinon.assert.calledWith(this.callingServiceAccept, '456', false);
      });

      it('updates the active call state with ACCEPT_CALL_PENDING', async () => {
        const dispatch = sinon.spy();
        await acceptCall({
          conversationId: 'fake-direct-call-conversation-id',
          asVideoCall: true,
        })(dispatch, getEmptyRootState, null);
        const action = dispatch.getCall(0).args[0];

        const result = reducer(stateWithIncomingDirectCall, action);

        assert.deepEqual(result.activeCallState, {
          conversationId: 'fake-direct-call-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: true,
          participantsList: false,
          pip: false,
          settingsDialogOpen: false,
        });
      });
    });

    describe('setLocalAudio', () => {
      const { setLocalAudio } = actions;

      beforeEach(function beforeEach() {
        this.callingServiceSetOutgoingAudio = this.sandbox.stub(
          callingService,
          'setOutgoingAudio'
        );
      });

      it('dispatches a SET_LOCAL_AUDIO_FULFILLED action', () => {
        const dispatch = sinon.spy();

        setLocalAudio({ enabled: true })(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/SET_LOCAL_AUDIO_FULFILLED',
          payload: { enabled: true },
        });
      });

      it('updates the outgoing audio for the active call', function test() {
        const dispatch = sinon.spy();

        setLocalAudio({ enabled: false })(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            calling: stateWithActiveDirectCall,
          }),
          null
        );

        sinon.assert.calledOnce(this.callingServiceSetOutgoingAudio);
        sinon.assert.calledWith(
          this.callingServiceSetOutgoingAudio,
          'fake-direct-call-conversation-id',
          false
        );

        setLocalAudio({ enabled: true })(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            calling: stateWithActiveDirectCall,
          }),
          null
        );

        sinon.assert.calledTwice(this.callingServiceSetOutgoingAudio);
        sinon.assert.calledWith(
          this.callingServiceSetOutgoingAudio,
          'fake-direct-call-conversation-id',
          true
        );
      });

      it('updates the local audio state with SET_LOCAL_AUDIO_FULFILLED', () => {
        const dispatch = sinon.spy();
        setLocalAudio({ enabled: false })(dispatch, getEmptyRootState, null);
        const action = dispatch.getCall(0).args[0];

        const result = reducer(stateWithActiveDirectCall, action);

        assert.isFalse(result.activeCallState?.hasLocalAudio);
      });
    });

    describe('showCallLobby', () => {
      const { showCallLobby } = actions;

      it('saves the call and makes it active', () => {
        const result = reducer(
          getEmptyState(),
          showCallLobby({
            conversationId: 'fake-conversation-id',
            isVideoCall: true,
          })
        );

        assert.deepEqual(result.callsByConversation['fake-conversation-id'], {
          conversationId: 'fake-conversation-id',
          isIncoming: false,
          isVideoCall: true,
        });
        assert.deepEqual(result.activeCallState, {
          conversationId: 'fake-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: true,
          participantsList: false,
          pip: false,
          settingsDialogOpen: false,
        });
      });
    });

    describe('startCall', () => {
      const { startCall } = actions;

      beforeEach(function beforeEach() {
        this.callingStartOutgoingCall = this.sandbox.stub(
          callingService,
          'startOutgoingCall'
        );
      });

      it('asks the calling service to start an outgoing call', function test() {
        startCall({
          conversationId: '123',
          hasLocalAudio: true,
          hasLocalVideo: false,
        });

        sinon.assert.calledOnce(this.callingStartOutgoingCall);
        sinon.assert.calledWith(
          this.callingStartOutgoingCall,
          '123',
          true,
          false
        );
      });

      it('saves the call and makes it active', () => {
        const result = reducer(
          getEmptyState(),
          startCall({
            conversationId: 'fake-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: false,
          })
        );

        assert.deepEqual(result.callsByConversation['fake-conversation-id'], {
          conversationId: 'fake-conversation-id',
          callState: CallState.Prering,
          isIncoming: false,
          isVideoCall: false,
        });
        assert.deepEqual(result.activeCallState, {
          conversationId: 'fake-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: false,
          participantsList: false,
          pip: false,
          settingsDialogOpen: false,
        });
      });
    });

    describe('toggleSettings', () => {
      const { toggleSettings } = actions;

      it('toggles the settings dialog', () => {
        const afterOneToggle = reducer(
          stateWithActiveDirectCall,
          toggleSettings()
        );
        const afterTwoToggles = reducer(afterOneToggle, toggleSettings());
        const afterThreeToggles = reducer(afterTwoToggles, toggleSettings());

        assert.isTrue(afterOneToggle.activeCallState?.settingsDialogOpen);
        assert.isFalse(afterTwoToggles.activeCallState?.settingsDialogOpen);
        assert.isTrue(afterThreeToggles.activeCallState?.settingsDialogOpen);
      });
    });

    describe('toggleParticipants', () => {
      const { toggleParticipants } = actions;

      it('toggles the participants list', () => {
        const afterOneToggle = reducer(
          stateWithActiveDirectCall,
          toggleParticipants()
        );
        const afterTwoToggles = reducer(afterOneToggle, toggleParticipants());
        const afterThreeToggles = reducer(
          afterTwoToggles,
          toggleParticipants()
        );

        assert.isTrue(afterOneToggle.activeCallState?.participantsList);
        assert.isFalse(afterTwoToggles.activeCallState?.participantsList);
        assert.isTrue(afterThreeToggles.activeCallState?.participantsList);
      });
    });

    describe('togglePip', () => {
      const { togglePip } = actions;

      it('toggles the PiP', () => {
        const afterOneToggle = reducer(stateWithActiveDirectCall, togglePip());
        const afterTwoToggles = reducer(afterOneToggle, togglePip());
        const afterThreeToggles = reducer(afterTwoToggles, togglePip());

        assert.isTrue(afterOneToggle.activeCallState?.pip);
        assert.isFalse(afterTwoToggles.activeCallState?.pip);
        assert.isTrue(afterThreeToggles.activeCallState?.pip);
      });
    });
  });
});
