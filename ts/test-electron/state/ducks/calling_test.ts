// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import type {
  CallingStateType,
  GroupCallStateChangeActionType,
} from '../../../state/ducks/calling';
import {
  actions,
  getActiveCall,
  getEmptyState,
  isAnybodyElseInGroupCall,
  reducer,
} from '../../../state/ducks/calling';
import { calling as callingService } from '../../../services/calling';
import {
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../../../types/Calling';
import { UUID } from '../../../types/UUID';
import type { UUIDStringType } from '../../../types/UUID';

describe('calling duck', () => {
  const stateWithDirectCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-direct-call-conversation-id': {
        callMode: CallMode.Direct as CallMode.Direct,
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
      isInSpeakerView: false,
      showParticipantsList: false,
      safetyNumberChangedUuids: [],
      outgoingRing: true,
      pip: false,
      settingsDialogOpen: false,
    },
  };

  const stateWithIncomingDirectCall = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-direct-call-conversation-id': {
        callMode: CallMode.Direct as CallMode.Direct,
        conversationId: 'fake-direct-call-conversation-id',
        callState: CallState.Ringing,
        isIncoming: true,
        isVideoCall: false,
        hasRemoteVideo: false,
      },
    },
  };

  const creatorUuid = UUID.generate().toString();
  const differentCreatorUuid = UUID.generate().toString();
  const remoteUuid = UUID.generate().toString();
  const ringerUuid = UUID.generate().toString();

  const stateWithGroupCall = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-group-call-conversation-id': {
        callMode: CallMode.Group as CallMode.Group,
        conversationId: 'fake-group-call-conversation-id',
        connectionState: GroupCallConnectionState.Connected,
        joinState: GroupCallJoinState.NotJoined,
        peekInfo: {
          uuids: [creatorUuid],
          creatorUuid,
          eraId: 'xyz',
          maxDevices: 16,
          deviceCount: 1,
        },
        remoteParticipants: [
          {
            uuid: remoteUuid,
            demuxId: 123,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            presenting: false,
            sharingScreen: false,
            videoAspectRatio: 4 / 3,
          },
        ],
      },
    },
  };

  const stateWithIncomingGroupCall = {
    ...stateWithGroupCall,
    callsByConversation: {
      ...stateWithGroupCall.callsByConversation,
      'fake-group-call-conversation-id': {
        ...stateWithGroupCall.callsByConversation[
          'fake-group-call-conversation-id'
        ],
        ringId: BigInt(123),
        ringerUuid: UUID.generate().toString(),
      },
    },
  };

  const stateWithActiveGroupCall = {
    ...stateWithGroupCall,
    activeCallState: {
      conversationId: 'fake-group-call-conversation-id',
      hasLocalAudio: true,
      hasLocalVideo: false,
      isInSpeakerView: false,
      showParticipantsList: false,
      safetyNumberChangedUuids: [],
      outgoingRing: false,
      pip: false,
      settingsDialogOpen: false,
    },
  };

  const ourUuid = UUID.generate().toString();

  const getEmptyRootState = () => {
    const rootState = rootReducer(undefined, noopAction());
    return {
      ...rootState,
      user: {
        ...rootState.user,
        ourUuid,
      },
    };
  };

  beforeEach(function beforeEach() {
    this.sandbox = sinon.createSandbox();
  });

  afterEach(function afterEach() {
    this.sandbox.restore();
  });

  describe('actions', () => {
    describe('getPresentingSources', () => {
      beforeEach(function beforeEach() {
        this.callingServiceGetPresentingSources = this.sandbox
          .stub(callingService, 'getPresentingSources')
          .resolves([
            {
              id: 'foo.bar',
              name: 'Foo Bar',
              thumbnail: 'xyz',
            },
          ]);
      });

      it('retrieves sources from the calling service', async function test() {
        const { getPresentingSources } = actions;
        const dispatch = sinon.spy();
        await getPresentingSources()(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(this.callingServiceGetPresentingSources);
      });

      it('dispatches SET_PRESENTING_SOURCES', async function test() {
        const { getPresentingSources } = actions;
        const dispatch = sinon.spy();
        await getPresentingSources()(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/SET_PRESENTING_SOURCES',
          payload: [
            {
              id: 'foo.bar',
              name: 'Foo Bar',
              thumbnail: 'xyz',
            },
          ],
        });
      });
    });

    describe('remoteSharingScreenChange', () => {
      it("updates whether someone's screen is being shared", () => {
        const { remoteSharingScreenChange } = actions;

        const payload = {
          conversationId: 'fake-direct-call-conversation-id',
          isSharingScreen: true,
        };

        const state = {
          ...stateWithActiveDirectCall,
        };
        const nextState = reducer(state, remoteSharingScreenChange(payload));

        const expectedState = {
          ...stateWithActiveDirectCall,
          callsByConversation: {
            'fake-direct-call-conversation-id': {
              ...stateWithActiveDirectCall.callsByConversation[
                'fake-direct-call-conversation-id'
              ],
              isSharingScreen: true,
            },
          },
        };

        assert.deepEqual(nextState, expectedState);
      });
    });

    describe('setPresenting', () => {
      beforeEach(function beforeEach() {
        this.callingServiceSetPresenting = this.sandbox.stub(
          callingService,
          'setPresenting'
        );
      });

      it('calls setPresenting on the calling service', function test() {
        const { setPresenting } = actions;
        const dispatch = sinon.spy();
        const presentedSource = {
          id: 'window:786',
          name: 'Application',
        };
        const getState = () => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        setPresenting(presentedSource)(dispatch, getState, null);

        sinon.assert.calledOnce(this.callingServiceSetPresenting);
        sinon.assert.calledWith(
          this.callingServiceSetPresenting,
          'fake-group-call-conversation-id',
          false,
          presentedSource
        );
      });

      it('dispatches SET_PRESENTING', () => {
        const { setPresenting } = actions;
        const dispatch = sinon.spy();
        const presentedSource = {
          id: 'window:786',
          name: 'Application',
        };
        const getState = () => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        setPresenting(presentedSource)(dispatch, getState, null);

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/SET_PRESENTING',
          payload: presentedSource,
        });
      });

      it('turns off presenting when no value is passed in', () => {
        const dispatch = sinon.spy();
        const { setPresenting } = actions;
        const presentedSource = {
          id: 'window:786',
          name: 'Application',
        };

        const getState = () => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        setPresenting(presentedSource)(dispatch, getState, null);

        const action = dispatch.getCall(0).args[0];

        const nextState = reducer(getState().calling, action);

        assert.isDefined(nextState.activeCallState);
        assert.equal(
          nextState.activeCallState?.presentingSource,
          presentedSource
        );
        assert.isUndefined(
          nextState.activeCallState?.presentingSourcesAvailable
        );
      });

      it('sets the presenting value when one is passed in', () => {
        const dispatch = sinon.spy();
        const { setPresenting } = actions;

        const getState = () => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        setPresenting()(dispatch, getState, null);

        const action = dispatch.getCall(0).args[0];

        const nextState = reducer(getState().calling, action);

        assert.isDefined(nextState.activeCallState);
        assert.isUndefined(nextState.activeCallState?.presentingSource);
        assert.isUndefined(
          nextState.activeCallState?.presentingSourcesAvailable
        );
      });
    });

    describe('acceptCall', () => {
      const { acceptCall } = actions;

      beforeEach(function beforeEach() {
        this.callingServiceAccept = this.sandbox
          .stub(callingService, 'acceptDirectCall')
          .resolves();
        this.callingServiceJoin = this.sandbox
          .stub(callingService, 'joinGroupCall')
          .resolves();
      });

      describe('accepting a direct call', () => {
        const getState = () => ({
          ...getEmptyRootState(),
          calling: stateWithIncomingDirectCall,
        });

        it('dispatches an ACCEPT_CALL_PENDING action', async () => {
          const dispatch = sinon.spy();

          await acceptCall({
            conversationId: 'fake-direct-call-conversation-id',
            asVideoCall: true,
          })(dispatch, getState, null);

          sinon.assert.calledOnce(dispatch);
          sinon.assert.calledWith(dispatch, {
            type: 'calling/ACCEPT_CALL_PENDING',
            payload: {
              conversationId: 'fake-direct-call-conversation-id',
              asVideoCall: true,
            },
          });

          await acceptCall({
            conversationId: 'fake-direct-call-conversation-id',
            asVideoCall: false,
          })(dispatch, getState, null);

          sinon.assert.calledTwice(dispatch);
          sinon.assert.calledWith(dispatch, {
            type: 'calling/ACCEPT_CALL_PENDING',
            payload: {
              conversationId: 'fake-direct-call-conversation-id',
              asVideoCall: false,
            },
          });
        });

        it('asks the calling service to accept the call', async function test() {
          const dispatch = sinon.spy();

          await acceptCall({
            conversationId: 'fake-direct-call-conversation-id',
            asVideoCall: true,
          })(dispatch, getState, null);

          sinon.assert.calledOnce(this.callingServiceAccept);
          sinon.assert.calledWith(
            this.callingServiceAccept,
            'fake-direct-call-conversation-id',
            true
          );

          await acceptCall({
            conversationId: 'fake-direct-call-conversation-id',
            asVideoCall: false,
          })(dispatch, getState, null);

          sinon.assert.calledTwice(this.callingServiceAccept);
          sinon.assert.calledWith(
            this.callingServiceAccept,
            'fake-direct-call-conversation-id',
            false
          );
        });

        it('updates the active call state with ACCEPT_CALL_PENDING', async () => {
          const dispatch = sinon.spy();
          await acceptCall({
            conversationId: 'fake-direct-call-conversation-id',
            asVideoCall: true,
          })(dispatch, getState, null);
          const action = dispatch.getCall(0).args[0];

          const result = reducer(stateWithIncomingDirectCall, action);

          assert.deepEqual(result.activeCallState, {
            conversationId: 'fake-direct-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            isInSpeakerView: false,
            showParticipantsList: false,
            safetyNumberChangedUuids: [],
            outgoingRing: false,
            pip: false,
            settingsDialogOpen: false,
          });
        });
      });

      describe('accepting a group call', () => {
        const getState = () => ({
          ...getEmptyRootState(),
          calling: stateWithIncomingGroupCall,
        });

        it('dispatches an ACCEPT_CALL_PENDING action', async () => {
          const dispatch = sinon.spy();

          await acceptCall({
            conversationId: 'fake-group-call-conversation-id',
            asVideoCall: true,
          })(dispatch, getState, null);

          sinon.assert.calledOnce(dispatch);
          sinon.assert.calledWith(dispatch, {
            type: 'calling/ACCEPT_CALL_PENDING',
            payload: {
              conversationId: 'fake-group-call-conversation-id',
              asVideoCall: true,
            },
          });

          await acceptCall({
            conversationId: 'fake-group-call-conversation-id',
            asVideoCall: false,
          })(dispatch, getState, null);

          sinon.assert.calledTwice(dispatch);
          sinon.assert.calledWith(dispatch, {
            type: 'calling/ACCEPT_CALL_PENDING',
            payload: {
              conversationId: 'fake-group-call-conversation-id',
              asVideoCall: false,
            },
          });
        });

        it('asks the calling service to join the call', async function test() {
          const dispatch = sinon.spy();

          await acceptCall({
            conversationId: 'fake-group-call-conversation-id',
            asVideoCall: true,
          })(dispatch, getState, null);

          sinon.assert.calledOnce(this.callingServiceJoin);
          sinon.assert.calledWith(
            this.callingServiceJoin,
            'fake-group-call-conversation-id',
            true,
            true
          );

          await acceptCall({
            conversationId: 'fake-group-call-conversation-id',
            asVideoCall: false,
          })(dispatch, getState, null);

          sinon.assert.calledTwice(this.callingServiceJoin);
          sinon.assert.calledWith(
            this.callingServiceJoin,
            'fake-group-call-conversation-id',
            true,
            false
          );
        });

        it('updates the active call state with ACCEPT_CALL_PENDING', async () => {
          const dispatch = sinon.spy();
          await acceptCall({
            conversationId: 'fake-group-call-conversation-id',
            asVideoCall: true,
          })(dispatch, getState, null);
          const action = dispatch.getCall(0).args[0];

          const result = reducer(stateWithIncomingGroupCall, action);

          assert.deepEqual(result.activeCallState, {
            conversationId: 'fake-group-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            isInSpeakerView: false,
            showParticipantsList: false,
            safetyNumberChangedUuids: [],
            outgoingRing: false,
            pip: false,
            settingsDialogOpen: false,
          });
        });
      });
    });

    describe('cancelCall', () => {
      const { cancelCall } = actions;

      beforeEach(function beforeEach() {
        this.callingServiceStopCallingLobby = this.sandbox.stub(
          callingService,
          'stopCallingLobby'
        );
      });

      it('stops the calling lobby for that conversation', function test() {
        cancelCall({ conversationId: '123' });

        sinon.assert.calledOnce(this.callingServiceStopCallingLobby);
        sinon.assert.calledWith(this.callingServiceStopCallingLobby, '123');
      });

      it('completely removes an active direct call from the state', () => {
        const result = reducer(
          stateWithActiveDirectCall,
          cancelCall({ conversationId: 'fake-direct-call-conversation-id' })
        );

        assert.notProperty(
          result.callsByConversation,
          'fake-direct-call-conversation-id'
        );
        assert.isUndefined(result.activeCallState);
      });

      it('removes the active group call, but leaves it in the state', () => {
        const result = reducer(
          stateWithActiveGroupCall,
          cancelCall({ conversationId: 'fake-group-call-conversation-id' })
        );

        assert.property(
          result.callsByConversation,
          'fake-group-call-conversation-id'
        );
        assert.isUndefined(result.activeCallState);
      });
    });

    describe('cancelIncomingGroupCallRing', () => {
      const { cancelIncomingGroupCallRing } = actions;

      it('does nothing if there is no associated group call', () => {
        const state = getEmptyState();
        const action = cancelIncomingGroupCallRing({
          conversationId: 'garbage',
          ringId: BigInt(1),
        });

        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it("does nothing if the ring to cancel isn't the same one", () => {
        const action = cancelIncomingGroupCallRing({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(999),
        });

        const result = reducer(stateWithIncomingGroupCall, action);

        assert.strictEqual(result, stateWithIncomingGroupCall);
      });

      it("removes the call from the state if it's not connected", () => {
        const state = {
          ...stateWithGroupCall,
          callsByConversation: {
            ...stateWithGroupCall.callsByConversation,
            'fake-group-call-conversation-id': {
              ...stateWithGroupCall.callsByConversation[
                'fake-group-call-conversation-id'
              ],
              connectionState: GroupCallConnectionState.NotConnected,
              ringId: BigInt(123),
              ringerUuid: UUID.generate().toString(),
            },
          },
        };
        const action = cancelIncomingGroupCallRing({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(123),
        });

        const result = reducer(state, action);

        assert.notProperty(
          result.callsByConversation,
          'fake-group-call-conversation-id'
        );
      });

      it("removes the ring state, but not the call, if it's connected", () => {
        const action = cancelIncomingGroupCallRing({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(123),
        });

        const result = reducer(stateWithIncomingGroupCall, action);
        const call =
          result.callsByConversation['fake-group-call-conversation-id'];
        // It'd be nice to do this with an assert, but Chai doesn't understand it.
        if (call?.callMode !== CallMode.Group) {
          throw new Error('Expected to find a group call');
        }

        assert.isUndefined(call.ringId);
        assert.isUndefined(call.ringerUuid);
      });
    });

    describe('declineCall', () => {
      const { declineCall } = actions;

      let declineDirectCall: sinon.SinonStub;
      let declineGroupCall: sinon.SinonStub;

      beforeEach(function beforeEach() {
        declineDirectCall = this.sandbox.stub(
          callingService,
          'declineDirectCall'
        );
        declineGroupCall = this.sandbox.stub(
          callingService,
          'declineGroupCall'
        );
      });

      describe('declining a direct call', () => {
        const getState = () => ({
          ...getEmptyRootState(),
          calling: stateWithIncomingDirectCall,
        });

        it('dispatches a DECLINE_DIRECT_CALL action', () => {
          const dispatch = sinon.spy();

          declineCall({ conversationId: 'fake-direct-call-conversation-id' })(
            dispatch,
            getState,
            null
          );

          sinon.assert.calledOnce(dispatch);
          sinon.assert.calledWith(dispatch, {
            type: 'calling/DECLINE_DIRECT_CALL',
            payload: {
              conversationId: 'fake-direct-call-conversation-id',
            },
          });
        });

        it('asks the calling service to decline the call', () => {
          const dispatch = sinon.spy();

          declineCall({ conversationId: 'fake-direct-call-conversation-id' })(
            dispatch,
            getState,
            null
          );

          sinon.assert.calledOnce(declineDirectCall);
          sinon.assert.calledWith(
            declineDirectCall,
            'fake-direct-call-conversation-id'
          );
        });

        it('removes the call from the state', () => {
          const dispatch = sinon.spy();
          declineCall({ conversationId: 'fake-direct-call-conversation-id' })(
            dispatch,
            getState,
            null
          );
          const action = dispatch.getCall(0).args[0];

          const result = reducer(stateWithIncomingGroupCall, action);

          assert.notProperty(
            result.callsByConversation,
            'fake-direct-call-conversation-id'
          );
        });
      });

      describe('declining a group call', () => {
        const getState = () => ({
          ...getEmptyRootState(),
          calling: stateWithIncomingGroupCall,
        });

        it('dispatches a CANCEL_INCOMING_GROUP_CALL_RING action', () => {
          const dispatch = sinon.spy();

          declineCall({ conversationId: 'fake-group-call-conversation-id' })(
            dispatch,
            getState,
            null
          );

          sinon.assert.calledOnce(dispatch);
          sinon.assert.calledWith(dispatch, {
            type: 'calling/CANCEL_INCOMING_GROUP_CALL_RING',
            payload: {
              conversationId: 'fake-group-call-conversation-id',
              ringId: BigInt(123),
            },
          });
        });

        it('asks the calling service to decline the call', () => {
          const dispatch = sinon.spy();

          declineCall({ conversationId: 'fake-group-call-conversation-id' })(
            dispatch,
            getState,
            null
          );

          sinon.assert.calledOnce(declineGroupCall);
          sinon.assert.calledWith(
            declineGroupCall,
            'fake-group-call-conversation-id',
            BigInt(123)
          );
        });

        // NOTE: The state effects of this action are tested with
        //   `cancelIncomingGroupCallRing`.
      });
    });

    describe('groupCallStateChange', () => {
      const { groupCallStateChange } = actions;

      function getAction(
        ...args: Parameters<typeof groupCallStateChange>
      ): GroupCallStateChangeActionType {
        const dispatch = sinon.spy();

        groupCallStateChange(...args)(dispatch, getEmptyRootState, null);

        return dispatch.getCall(0).args[0];
      }

      it('ignores non-connected calls with no peeked participants', () => {
        const result = reducer(
          getEmptyState(),
          getAction({
            conversationId: 'abc123',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: false,
            hasLocalVideo: false,
            peekInfo: {
              uuids: [],
              maxDevices: 16,
              deviceCount: 0,
            },
            remoteParticipants: [],
          })
        );

        assert.deepEqual(result, getEmptyState());
      });

      it('removes the call from the map of conversations if the call is not connected and has no peeked participants or ringer', () => {
        const result = reducer(
          stateWithGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: false,
            hasLocalVideo: false,
            peekInfo: {
              uuids: [],
              maxDevices: 16,
              deviceCount: 0,
            },
            remoteParticipants: [],
          })
        );

        assert.notProperty(
          result.callsByConversation,
          'fake-group-call-conversation-id'
        );
      });

      it('removes the call from the map of conversations if the call is not connected and has 1 peeked participant: you', () => {
        const result = reducer(
          stateWithGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: false,
            hasLocalVideo: false,
            peekInfo: {
              uuids: [ourUuid],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [],
          })
        );

        assert.notProperty(
          result.callsByConversation,
          'fake-group-call-conversation-id'
        );
      });

      it('drops the active call if it is disconnected with no peeked participants', () => {
        const result = reducer(
          stateWithActiveGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: false,
            hasLocalVideo: false,
            peekInfo: {
              uuids: [],
              maxDevices: 16,
              deviceCount: 0,
            },
            remoteParticipants: [],
          })
        );

        assert.isUndefined(result.activeCallState);
      });

      it('drops the active call if it is disconnected with 1 peeked participant (you)', () => {
        const result = reducer(
          stateWithActiveGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: false,
            hasLocalVideo: false,
            peekInfo: {
              uuids: [ourUuid],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [],
          })
        );

        assert.isUndefined(result.activeCallState);
      });

      it('saves a new call to the map of conversations', () => {
        const result = reducer(
          getEmptyState(),
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joining,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              uuids: [creatorUuid],
              creatorUuid,
              eraId: 'xyz',
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          })
        );

        assert.deepEqual(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joining,
            peekInfo: {
              uuids: [creatorUuid],
              creatorUuid,
              eraId: 'xyz',
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          }
        );
      });

      it('saves a new call to the map of conversations if the call is disconnected by has peeked participants that are not you', () => {
        const result = reducer(
          stateWithGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: false,
            hasLocalVideo: false,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [],
          })
        );

        assert.deepEqual(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [],
          }
        );
      });

      it('saves a call to the map of conversations if the call had a ringer, even if it was otherwise ignorable', () => {
        const result = reducer(
          stateWithIncomingGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: false,
            hasLocalVideo: false,
            peekInfo: {
              uuids: [],
              maxDevices: 16,
              deviceCount: 0,
            },
            remoteParticipants: [],
          })
        );

        assert.isDefined(
          result.callsByConversation['fake-group-call-conversation-id']
        );
      });

      it('updates a call in the map of conversations', () => {
        const result = reducer(
          stateWithGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          })
        );

        assert.deepEqual(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          }
        );
      });

      it("keeps the existing ring state if you haven't joined the call", () => {
        const state = {
          ...stateWithGroupCall,
          callsByConversation: {
            ...stateWithGroupCall.callsByConversation,
            'fake-group-call-conversation-id': {
              ...stateWithGroupCall.callsByConversation[
                'fake-group-call-conversation-id'
              ],
              ringId: BigInt(456),
              ringerUuid,
            },
          },
        };
        const result = reducer(
          state,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          })
        );

        assert.include(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            callMode: CallMode.Group,
            ringId: BigInt(456),
            ringerUuid,
          }
        );
      });

      it("removes the ring state if you've joined the call", () => {
        const state = {
          ...stateWithGroupCall,
          callsByConversation: {
            ...stateWithGroupCall.callsByConversation,
            'fake-group-call-conversation-id': {
              ...stateWithGroupCall.callsByConversation[
                'fake-group-call-conversation-id'
              ],
              ringId: BigInt(456),
              ringerUuid,
            },
          },
        };
        const result = reducer(
          state,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          })
        );

        assert.notProperty(
          result.callsByConversation['fake-group-call-conversation-id'],
          'ringId'
        );
        assert.notProperty(
          result.callsByConversation['fake-group-call-conversation-id'],
          'ringerUuid'
        );
      });

      it("if no call is active, doesn't touch the active call state", () => {
        const result = reducer(
          stateWithGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          })
        );

        assert.isUndefined(result.activeCallState);
      });

      it("if the call is not active, doesn't touch the active call state", () => {
        const result = reducer(
          stateWithActiveGroupCall,
          getAction({
            conversationId: 'another-fake-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          })
        );

        assert.deepEqual(result.activeCallState, {
          conversationId: 'fake-group-call-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: false,
          isInSpeakerView: false,
          showParticipantsList: false,
          safetyNumberChangedUuids: [],
          outgoingRing: false,
          pip: false,
          settingsDialogOpen: false,
        });
      });

      it('if the call is active, updates the active call state', () => {
        const result = reducer(
          stateWithActiveGroupCall,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          })
        );

        assert.strictEqual(
          result.activeCallState?.conversationId,
          'fake-group-call-conversation-id'
        );
        assert.isTrue(result.activeCallState?.hasLocalAudio);
        assert.isTrue(result.activeCallState?.hasLocalVideo);
      });

      it("doesn't stop ringing if nobody is in the call", () => {
        const state = {
          ...stateWithActiveGroupCall,
          activeCallState: {
            ...stateWithActiveGroupCall.activeCallState,
            outgoingRing: true,
          },
        };
        const result = reducer(
          state,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              uuids: [],
              maxDevices: 16,
              deviceCount: 0,
            },
            remoteParticipants: [],
          })
        );

        assert.isTrue(result.activeCallState?.outgoingRing);
      });

      it('stops ringing if someone enters the call', () => {
        const state = {
          ...stateWithActiveGroupCall,
          activeCallState: {
            ...stateWithActiveGroupCall.activeCallState,
            outgoingRing: true,
          },
        };
        const result = reducer(
          state,
          getAction({
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              uuids: ['1b9e4d42-1f56-45c5-b6f4-d1be5a54fefa'],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [],
          })
        );

        assert.isFalse(result.activeCallState?.outgoingRing);
      });
    });

    describe('peekNotConnectedGroupCall', () => {
      const { peekNotConnectedGroupCall } = actions;

      beforeEach(function beforeEach() {
        this.callingServicePeekGroupCall = this.sandbox.stub(
          callingService,
          'peekGroupCall'
        );
        this.callingServiceUpdateCallHistoryForGroupCall = this.sandbox.stub(
          callingService,
          'updateCallHistoryForGroupCall'
        );
        this.clock = this.sandbox.useFakeTimers();
      });

      describe('thunk', () => {
        function noopTest(connectionState: GroupCallConnectionState) {
          return async function test(this: Mocha.Context) {
            const dispatch = sinon.spy();

            await peekNotConnectedGroupCall({
              conversationId: 'fake-group-call-conversation-id',
            })(
              dispatch,
              () => ({
                ...getEmptyRootState(),
                calling: {
                  ...stateWithGroupCall,
                  callsByConversation: {
                    'fake-group-call-conversation-id': {
                      ...stateWithGroupCall.callsByConversation[
                        'fake-group-call-conversation-id'
                      ],
                      connectionState,
                    },
                  },
                },
              }),
              null
            );

            sinon.assert.notCalled(dispatch);
            sinon.assert.notCalled(this.callingServicePeekGroupCall);
          };
        }

        it(
          'no-ops if trying to peek at a connecting group call',
          noopTest(GroupCallConnectionState.Connecting)
        );

        it(
          'no-ops if trying to peek at a connected group call',
          noopTest(GroupCallConnectionState.Connected)
        );

        it(
          'no-ops if trying to peek at a reconnecting group call',
          noopTest(GroupCallConnectionState.Reconnecting)
        );

        // These tests are incomplete.
      });
    });

    describe('returnToActiveCall', () => {
      const { returnToActiveCall } = actions;

      it('does nothing if not in PiP mode', () => {
        const result = reducer(stateWithActiveDirectCall, returnToActiveCall());

        assert.deepEqual(result, stateWithActiveDirectCall);
      });

      it('closes the PiP', () => {
        const state = {
          ...stateWithActiveDirectCall,
          activeCallState: {
            ...stateWithActiveDirectCall.activeCallState,
            pip: true,
          },
        };
        const result = reducer(state, returnToActiveCall());

        assert.deepEqual(result, stateWithActiveDirectCall);
      });
    });

    describe('receiveIncomingGroupCall', () => {
      const { receiveIncomingGroupCall } = actions;

      it('does nothing if the call was already ringing', () => {
        const action = receiveIncomingGroupCall({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(456),
          ringerUuid,
        });
        const result = reducer(stateWithIncomingGroupCall, action);

        assert.strictEqual(result, stateWithIncomingGroupCall);
      });

      it('does nothing if the call was already joined', () => {
        const state = {
          ...stateWithGroupCall,
          callsByConversation: {
            ...stateWithGroupCall.callsByConversation,
            'fake-group-call-conversation-id': {
              ...stateWithGroupCall.callsByConversation[
                'fake-group-call-conversation-id'
              ],
              joinState: GroupCallJoinState.Joined,
            },
          },
        };
        const action = receiveIncomingGroupCall({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(456),
          ringerUuid,
        });
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('creates a new group call if one did not exist', () => {
        const action = receiveIncomingGroupCall({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(456),
          ringerUuid,
        });
        const result = reducer(getEmptyState(), action);

        assert.deepEqual(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: {
              uuids: [],
              maxDevices: Infinity,
              deviceCount: 0,
            },
            remoteParticipants: [],
            ringId: BigInt(456),
            ringerUuid,
          }
        );
      });

      it('attaches ring state to an existing call', () => {
        const action = receiveIncomingGroupCall({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(456),
          ringerUuid,
        });
        const result = reducer(stateWithGroupCall, action);

        assert.include(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            ringId: BigInt(456),
            ringerUuid,
          }
        );
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

        setLocalAudio({ enabled: true })(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            calling: stateWithActiveDirectCall,
          }),
          null
        );

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
        setLocalAudio({ enabled: false })(
          dispatch,
          () => ({
            ...getEmptyRootState(),
            calling: stateWithActiveDirectCall,
          }),
          null
        );
        const action = dispatch.getCall(0).args[0];

        const result = reducer(stateWithActiveDirectCall, action);

        assert.isFalse(result.activeCallState?.hasLocalAudio);
      });
    });

    describe('setOutgoingRing', () => {
      const { setOutgoingRing } = actions;

      it('enables a desire to ring', () => {
        const action = setOutgoingRing(true);
        const result = reducer(stateWithActiveGroupCall, action);

        assert.isTrue(result.activeCallState?.outgoingRing);
      });

      it('disables a desire to ring', () => {
        const action = setOutgoingRing(false);
        const result = reducer(stateWithActiveDirectCall, action);

        assert.isFalse(result.activeCallState?.outgoingRing);
      });
    });

    describe('showCallLobby', () => {
      const { showCallLobby } = actions;

      it('saves a direct call and makes it active', () => {
        const result = reducer(
          getEmptyState(),
          showCallLobby({
            callMode: CallMode.Direct,
            conversationId: 'fake-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
          })
        );

        assert.deepEqual(result.callsByConversation['fake-conversation-id'], {
          callMode: CallMode.Direct,
          conversationId: 'fake-conversation-id',
          isIncoming: false,
          isVideoCall: true,
        });
        assert.deepEqual(result.activeCallState, {
          conversationId: 'fake-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: true,
          isInSpeakerView: false,
          showParticipantsList: false,
          safetyNumberChangedUuids: [],
          pip: false,
          settingsDialogOpen: false,
          outgoingRing: true,
        });
      });

      it('saves a group call and makes it active', () => {
        const result = reducer(
          getEmptyState(),
          showCallLobby({
            callMode: CallMode.Group,
            conversationId: 'fake-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            isConversationTooBigToRing: false,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: {
              uuids: [creatorUuid],
              creatorUuid,
              eraId: 'xyz',
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          })
        );

        assert.deepEqual(result.callsByConversation['fake-conversation-id'], {
          callMode: CallMode.Group,
          conversationId: 'fake-conversation-id',
          connectionState: GroupCallConnectionState.Connected,
          joinState: GroupCallJoinState.NotJoined,
          peekInfo: {
            uuids: [creatorUuid],
            creatorUuid,
            eraId: 'xyz',
            maxDevices: 16,
            deviceCount: 1,
          },
          remoteParticipants: [
            {
              uuid: remoteUuid,
              demuxId: 123,
              hasRemoteAudio: true,
              hasRemoteVideo: true,
              presenting: false,
              sharingScreen: false,
              videoAspectRatio: 4 / 3,
            },
          ],
        });
        assert.deepEqual(
          result.activeCallState?.conversationId,
          'fake-conversation-id'
        );
        assert.isFalse(result.activeCallState?.outgoingRing);
      });

      it('chooses fallback peek info if none is sent and there is no existing call', () => {
        const result = reducer(
          getEmptyState(),
          showCallLobby({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            isConversationTooBigToRing: false,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: undefined,
            remoteParticipants: [],
          })
        );

        const call =
          result.callsByConversation['fake-group-call-conversation-id'];
        assert.deepEqual(call?.callMode === CallMode.Group && call.peekInfo, {
          uuids: [],
          maxDevices: Infinity,
          deviceCount: 0,
        });
      });

      it("doesn't overwrite an existing group call's peek info if none was sent", () => {
        const result = reducer(
          stateWithGroupCall,
          showCallLobby({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            isConversationTooBigToRing: false,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: undefined,
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          })
        );

        const call =
          result.callsByConversation['fake-group-call-conversation-id'];
        assert.deepEqual(call?.callMode === CallMode.Group && call.peekInfo, {
          uuids: [creatorUuid],
          creatorUuid,
          eraId: 'xyz',
          maxDevices: 16,
          deviceCount: 1,
        });
      });

      it("can overwrite an existing group call's peek info", () => {
        const result = reducer(
          stateWithGroupCall,
          showCallLobby({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            isConversationTooBigToRing: false,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: {
              uuids: [differentCreatorUuid],
              creatorUuid: differentCreatorUuid,
              eraId: 'abc',
              maxDevices: 5,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          })
        );

        const call =
          result.callsByConversation['fake-group-call-conversation-id'];
        assert.deepEqual(call?.callMode === CallMode.Group && call.peekInfo, {
          uuids: [differentCreatorUuid],
          creatorUuid: differentCreatorUuid,
          eraId: 'abc',
          maxDevices: 5,
          deviceCount: 1,
        });
      });

      it("doesn't overwrite an existing group call's ring state if it was set previously", () => {
        const result = reducer(
          {
            ...stateWithGroupCall,
            callsByConversation: {
              'fake-group-call-conversation-id': {
                ...stateWithGroupCall.callsByConversation[
                  'fake-group-call-conversation-id'
                ],
                ringId: BigInt(987),
                ringerUuid,
              },
            },
          },
          showCallLobby({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            isConversationTooBigToRing: false,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: undefined,
            remoteParticipants: [
              {
                uuid: remoteUuid,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          })
        );
        const call =
          result.callsByConversation['fake-group-call-conversation-id'];
        // It'd be nice to do this with an assert, but Chai doesn't understand it.
        if (call?.callMode !== CallMode.Group) {
          throw new Error('Expected to find a group call');
        }

        assert.strictEqual(call.ringId, BigInt(987));
        assert.strictEqual(call.ringerUuid, ringerUuid);
      });
    });

    describe('startCall', () => {
      const { startCall } = actions;

      beforeEach(function beforeEach() {
        this.callingStartOutgoingDirectCall = this.sandbox.stub(
          callingService,
          'startOutgoingDirectCall'
        );
        this.callingJoinGroupCall = this.sandbox
          .stub(callingService, 'joinGroupCall')
          .resolves();
      });

      it('asks the calling service to start an outgoing direct call', async function test() {
        const dispatch = sinon.spy();
        await startCall({
          callMode: CallMode.Direct,
          conversationId: '123',
          hasLocalAudio: true,
          hasLocalVideo: false,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(this.callingStartOutgoingDirectCall);
        sinon.assert.calledWith(
          this.callingStartOutgoingDirectCall,
          '123',
          true,
          false
        );

        sinon.assert.notCalled(this.callingJoinGroupCall);
      });

      it('asks the calling service to join a group call', async function test() {
        const dispatch = sinon.spy();
        await startCall({
          callMode: CallMode.Group,
          conversationId: '123',
          hasLocalAudio: true,
          hasLocalVideo: false,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.calledOnce(this.callingJoinGroupCall);
        sinon.assert.calledWith(this.callingJoinGroupCall, '123', true, false);

        sinon.assert.notCalled(this.callingStartOutgoingDirectCall);
      });

      it('saves direct calls and makes them active', () => {
        const dispatch = sinon.spy();
        startCall({
          callMode: CallMode.Direct,
          conversationId: 'fake-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: false,
        })(dispatch, getEmptyRootState, null);
        const action = dispatch.getCall(0).args[0];

        const result = reducer(getEmptyState(), action);

        assert.deepEqual(result.callsByConversation['fake-conversation-id'], {
          callMode: CallMode.Direct,
          conversationId: 'fake-conversation-id',
          callState: CallState.Prering,
          isIncoming: false,
          isVideoCall: false,
        });
        assert.deepEqual(result.activeCallState, {
          conversationId: 'fake-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: false,
          isInSpeakerView: false,
          showParticipantsList: false,
          safetyNumberChangedUuids: [],
          pip: false,
          settingsDialogOpen: false,
          outgoingRing: true,
        });
      });

      it("doesn't dispatch any actions for group calls", () => {
        const dispatch = sinon.spy();
        startCall({
          callMode: CallMode.Group,
          conversationId: '123',
          hasLocalAudio: true,
          hasLocalVideo: false,
        })(dispatch, getEmptyRootState, null);

        sinon.assert.notCalled(dispatch);
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

        assert.isTrue(afterOneToggle.activeCallState?.showParticipantsList);
        assert.isFalse(afterTwoToggles.activeCallState?.showParticipantsList);
        assert.isTrue(afterThreeToggles.activeCallState?.showParticipantsList);
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

    describe('toggleSpeakerView', () => {
      const { toggleSpeakerView } = actions;

      it('toggles speaker view', () => {
        const afterOneToggle = reducer(
          stateWithActiveGroupCall,
          toggleSpeakerView()
        );
        const afterTwoToggles = reducer(afterOneToggle, toggleSpeakerView());
        const afterThreeToggles = reducer(afterTwoToggles, toggleSpeakerView());

        assert.isTrue(afterOneToggle.activeCallState?.isInSpeakerView);
        assert.isFalse(afterTwoToggles.activeCallState?.isInSpeakerView);
        assert.isTrue(afterThreeToggles.activeCallState?.isInSpeakerView);
      });
    });
  });

  describe('helpers', () => {
    describe('getActiveCall', () => {
      it('returns undefined if there are no calls', () => {
        assert.isUndefined(getActiveCall(getEmptyState()));
      });

      it('returns undefined if there is no active call', () => {
        assert.isUndefined(getActiveCall(stateWithDirectCall));
      });

      it('returns the active call', () => {
        assert.deepEqual(getActiveCall(stateWithActiveDirectCall), {
          callMode: CallMode.Direct,
          conversationId: 'fake-direct-call-conversation-id',
          callState: CallState.Accepted,
          isIncoming: false,
          isVideoCall: false,
          hasRemoteVideo: false,
        });
      });
    });

    describe('isAnybodyElseInGroupCall', () => {
      const fakePeekInfo = (uuids: Array<UUIDStringType>) => ({
        uuids,
        maxDevices: 5,
        deviceCount: uuids.length,
      });

      it('returns false if the peek info has no participants', () => {
        assert.isFalse(isAnybodyElseInGroupCall(fakePeekInfo([]), remoteUuid));
      });

      it('returns false if the peek info has one participant, you', () => {
        assert.isFalse(
          isAnybodyElseInGroupCall(fakePeekInfo([creatorUuid]), creatorUuid)
        );
      });

      it('returns true if the peek info has one participant, someone else', () => {
        assert.isTrue(
          isAnybodyElseInGroupCall(fakePeekInfo([creatorUuid]), remoteUuid)
        );
      });

      it('returns true if the peek info has two participants, you and someone else', () => {
        assert.isTrue(
          isAnybodyElseInGroupCall(
            fakePeekInfo([creatorUuid, remoteUuid]),
            remoteUuid
          )
        );
      });
    });
  });
});
