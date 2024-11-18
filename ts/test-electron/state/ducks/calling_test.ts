// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { cloneDeep, noop } from 'lodash';
import type { PeekInfo } from '@signalapp/ringrtc';
import type { StateType as RootStateType } from '../../../state/reducer';
import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import type {
  ActiveCallStateType,
  CallingActionType,
  CallingStateType,
  DirectCallStateType,
  GroupCallReactionsReceivedActionType,
  GroupCallStateChangeActionType,
  GroupCallStateType,
  HandleCallLinkUpdateType,
  SendGroupCallReactionActionType,
  StartCallLinkLobbyType,
} from '../../../state/ducks/calling';
import {
  actions,
  getActiveCall,
  getEmptyState,
  reducer,
} from '../../../state/ducks/calling';
import { isAnybodyElseInGroupCall } from '../../../state/ducks/callingHelpers';
import { truncateAudioLevel } from '../../../calling/truncateAudioLevel';
import { calling as callingService } from '../../../services/calling';
import {
  CallState,
  CallViewMode,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../../../types/Calling';
import { CallMode } from '../../../types/CallDisposition';
import { generateAci } from '../../../types/ServiceId';
import { getDefaultConversation } from '../../../test-both/helpers/getDefaultConversation';
import type { UnwrapPromise } from '../../../types/Util';
import {
  FAKE_CALL_LINK,
  FAKE_CALL_LINK_WITH_ADMIN_KEY,
  getCallLinkState,
} from '../../../test-both/helpers/fakeCallLink';
import { strictAssert } from '../../../util/assert';
import { callLinkRefreshJobQueue } from '../../../jobs/callLinkRefreshJobQueue';
import { CALL_LINK_DEFAULT_STATE } from '../../../util/callLinks';

const ACI_1 = generateAci();
const NOW = new Date('2020-01-23T04:56:00.000');

type CallingStateTypeWithActiveCall = CallingStateType & {
  activeCallState: ActiveCallStateType;
};

describe('calling duck', () => {
  const directCallState: DirectCallStateType = {
    callMode: CallMode.Direct,
    conversationId: 'fake-direct-call-conversation-id',
    callState: CallState.Accepted,
    isIncoming: false,
    isVideoCall: false,
    hasRemoteVideo: false,
  };
  const stateWithDirectCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      [directCallState.conversationId]: directCallState,
    },
  };

  const stateWithActiveDirectCall: CallingStateTypeWithActiveCall = {
    ...stateWithDirectCall,
    activeCallState: {
      state: 'Active',
      callMode: CallMode.Direct,
      conversationId: directCallState.conversationId,
      hasLocalAudio: true,
      hasLocalVideo: false,
      localAudioLevel: 0,
      viewMode: CallViewMode.Paginated,
      showParticipantsList: false,
      outgoingRing: true,
      pip: false,
      settingsDialogOpen: false,
      joinedAt: null,
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
      } satisfies DirectCallStateType,
    },
  };

  const creatorAci = generateAci();
  const differentCreatorAci = generateAci();
  const remoteAci = generateAci();
  const ringerAci = generateAci();

  const stateWithGroupCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-group-call-conversation-id': {
        callMode: CallMode.Group,
        conversationId: 'fake-group-call-conversation-id',
        connectionState: GroupCallConnectionState.Connected,
        joinState: GroupCallJoinState.NotJoined,
        localDemuxId: 1,
        peekInfo: {
          acis: [creatorAci],
          pendingAcis: [],
          creatorAci,
          eraId: 'xyz',
          maxDevices: 16,
          deviceCount: 1,
        },
        remoteParticipants: [
          {
            aci: remoteAci,
            demuxId: 123,
            hasRemoteAudio: true,
            hasRemoteVideo: true,
            mediaKeysReceived: true,
            presenting: false,
            sharingScreen: false,
            videoAspectRatio: 4 / 3,
          },
        ],
      } satisfies GroupCallStateType,
    },
  };

  const stateWithNotJoinedGroupCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-group-call-conversation-id': {
        callMode: CallMode.Group,
        conversationId: 'fake-group-call-conversation-id',
        connectionState: GroupCallConnectionState.NotConnected,
        joinState: GroupCallJoinState.NotJoined,
        localDemuxId: 1,
        peekInfo: {
          acis: [],
          pendingAcis: [],
          creatorAci,
          eraId: 'xyz',
          maxDevices: 16,
          deviceCount: 0,
        },
        remoteParticipants: [],
      } satisfies GroupCallStateType,
    },
  };

  const stateWithIncomingGroupCall: CallingStateType = {
    ...stateWithGroupCall,
    callsByConversation: {
      ...stateWithGroupCall.callsByConversation,
      'fake-group-call-conversation-id': {
        ...stateWithGroupCall.callsByConversation[
          'fake-group-call-conversation-id'
        ],
        ringId: BigInt(123),
        ringerAci: generateAci(),
      },
    },
  };

  const groupCallActiveCallState: ActiveCallStateType = {
    state: 'Active',
    callMode: CallMode.Group,
    conversationId: 'fake-group-call-conversation-id',
    hasLocalAudio: true,
    hasLocalVideo: false,
    localAudioLevel: 0,
    viewMode: CallViewMode.Paginated,
    showParticipantsList: false,
    outgoingRing: false,
    pip: false,
    settingsDialogOpen: false,
    joinedAt: null,
  };

  const stateWithActiveGroupCall: CallingStateTypeWithActiveCall = {
    ...stateWithGroupCall,
    activeCallState: groupCallActiveCallState,
  };

  const ourAci = generateAci();

  const getEmptyRootState = () => {
    const rootState = rootReducer(undefined, noopAction());
    return {
      ...rootState,
      user: {
        ...rootState.user,
        ourAci,
      },
    };
  };

  function useFakeTimers() {
    beforeEach(function (this: Mocha.Context) {
      this.sandbox = sinon.createSandbox();
      this.clock = this.sandbox.useFakeTimers({
        now: NOW,
      });
    });

    afterEach(function (this: Mocha.Context) {
      this.sandbox.restore();
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let oldEvents: any;
  beforeEach(function (this: Mocha.Context) {
    this.sandbox = sinon.createSandbox();

    oldEvents = window.Events;
    window.Events = {
      getCallRingtoneNotification: sinon.spy(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  afterEach(function (this: Mocha.Context) {
    this.sandbox.restore();

    window.Events = oldEvents;
  });

  describe('actions', () => {
    describe('remoteSharingScreenChange', () => {
      it("updates whether someone's screen is being shared", () => {
        const { remoteSharingScreenChange } = actions;

        const payload = {
          conversationId: 'fake-direct-call-conversation-id',
          isSharingScreen: true,
        };

        const state: CallingStateTypeWithActiveCall = {
          ...stateWithActiveDirectCall,
        };
        const nextState = reducer(state, remoteSharingScreenChange(payload));

        const expectedState: CallingStateTypeWithActiveCall = {
          ...stateWithActiveDirectCall,
          callsByConversation: {
            [directCallState.conversationId]: {
              ...directCallState,
              isSharingScreen: true,
            } satisfies DirectCallStateType,
          },
        };

        assert.deepEqual(nextState, expectedState);
      });
    });

    describe('_setPresenting', () => {
      beforeEach(function (this: Mocha.Context) {
        this.callingServiceSetPresenting = this.sandbox.stub(
          callingService,
          'setPresenting'
        );
      });

      it('calls _setPresenting on the calling service', async function (this: Mocha.Context) {
        const { _setPresenting } = actions;
        const dispatch = sinon.spy();
        const presentedSource = {
          id: 'window:786',
          name: 'Application',
        };
        const getState = (): RootStateType => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        await _setPresenting(presentedSource)(dispatch, getState, null);

        sinon.assert.calledOnce(this.callingServiceSetPresenting);
        sinon.assert.calledWith(this.callingServiceSetPresenting, {
          conversationId: 'fake-group-call-conversation-id',
          hasLocalVideo: false,
          mediaStream: undefined,
          source: presentedSource,
          callLinkRootKey: undefined,
        });
      });

      it('dispatches SET_PRESENTING', async () => {
        const { _setPresenting } = actions;
        const dispatch = sinon.spy();
        const presentedSource = {
          id: 'window:786',
          name: 'Application',
        };
        const getState = (): RootStateType => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        await _setPresenting(presentedSource)(dispatch, getState, null);

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/SET_PRESENTING',
          payload: presentedSource,
        });
      });

      it('turns off presenting when no value is passed in', async () => {
        const dispatch = sinon.spy();
        const { _setPresenting } = actions;
        const presentedSource = {
          id: 'window:786',
          name: 'Application',
        };

        const getState = (): RootStateType => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        await _setPresenting(presentedSource)(dispatch, getState, null);

        const action = dispatch.getCall(0).args[0];

        const nextState = reducer(getState().calling, action);

        assert.isDefined(nextState.activeCallState);
        strictAssert(
          nextState.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.equal(
          nextState.activeCallState?.presentingSource,
          presentedSource
        );
        assert.isUndefined(
          nextState.activeCallState?.presentingSourcesAvailable
        );
      });

      it('sets the presenting value when one is passed in', async () => {
        const dispatch = sinon.spy();
        const { _setPresenting } = actions;

        const getState = (): RootStateType => ({
          ...getEmptyRootState(),
          calling: {
            ...stateWithActiveGroupCall,
          },
        });

        await _setPresenting()(dispatch, getState, null);

        const action = dispatch.getCall(0).args[0];

        const nextState = reducer(getState().calling, action);

        assert.isDefined(nextState.activeCallState);
        strictAssert(
          nextState.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isUndefined(nextState.activeCallState?.presentingSource);
        assert.isUndefined(
          nextState.activeCallState?.presentingSourcesAvailable
        );
      });
    });

    describe('acceptCall', () => {
      const { acceptCall } = actions;

      beforeEach(function (this: Mocha.Context) {
        this.callingServiceAccept = this.sandbox
          .stub(callingService, 'acceptDirectCall')
          .resolves();
        this.callingServiceJoin = this.sandbox
          .stub(callingService, 'joinGroupCall')
          .resolves();
      });

      describe('accepting a direct call', () => {
        const getState = (): RootStateType => ({
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

        it('asks the calling service to accept the call', async function (this: Mocha.Context) {
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
            state: 'Active',
            callMode: CallMode.Direct,
            conversationId: 'fake-direct-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            localAudioLevel: 0,
            viewMode: CallViewMode.Paginated,
            showParticipantsList: false,
            outgoingRing: false,
            pip: false,
            settingsDialogOpen: false,
            joinedAt: null,
          } satisfies ActiveCallStateType);
        });
      });

      describe('accepting a group call', () => {
        const getState = (): RootStateType => ({
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

        it('asks the calling service to join the call', async function (this: Mocha.Context) {
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
            state: 'Active',
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            localAudioLevel: 0,
            viewMode: CallViewMode.Paginated,
            showParticipantsList: false,
            outgoingRing: false,
            pip: false,
            settingsDialogOpen: false,
            joinedAt: null,
          } satisfies ActiveCallStateType);
        });
      });
    });

    describe('cancelCall', () => {
      const { cancelCall } = actions;

      beforeEach(function (this: Mocha.Context) {
        this.callingServiceStopCallingLobby = this.sandbox.stub(
          callingService,
          'stopCallingLobby'
        );
      });

      it('stops the calling lobby for that conversation', function (this: Mocha.Context) {
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

      it('removes the ring state, but not the call', () => {
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
        assert.isUndefined(call.ringerAci);
      });
    });

    describe('declineCall', () => {
      const { declineCall } = actions;

      let declineDirectCall: sinon.SinonStub;
      let declineGroupCall: sinon.SinonStub;

      beforeEach(function (this: Mocha.Context) {
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
        const getState = (): RootStateType => ({
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
        const getState = (): RootStateType => ({
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

    describe('groupCallAudioLevelsChange', () => {
      const { groupCallAudioLevelsChange } = actions;

      const remoteDeviceStates = [
        { audioLevel: 0.3, demuxId: 1 },
        { audioLevel: 0.4, demuxId: 2 },
        { audioLevel: 0.5, demuxId: 3 },
        { audioLevel: 0.2, demuxId: 7 },
        { audioLevel: 0.1, demuxId: 8 },
        { audioLevel: 0, demuxId: 9 },
      ];

      const remoteAudioLevels = new Map<number, number>([
        [1, truncateAudioLevel(0.3)],
        [2, truncateAudioLevel(0.4)],
        [3, truncateAudioLevel(0.5)],
        [7, truncateAudioLevel(0.2)],
        [8, truncateAudioLevel(0.1)],
      ]);

      it("does nothing if there's no relevant call", () => {
        const action = groupCallAudioLevelsChange({
          callMode: CallMode.Group,
          conversationId: 'garbage',
          localAudioLevel: 1,
          remoteDeviceStates,
        });

        const result = reducer(stateWithActiveGroupCall, action);

        assert.strictEqual(result, stateWithActiveGroupCall);
      });

      it('does nothing if the state change would be a no-op', () => {
        const state = {
          ...stateWithActiveGroupCall,
          callsByConversation: {
            'fake-group-call-conversation-id': {
              ...stateWithActiveGroupCall.callsByConversation[
                'fake-group-call-conversation-id'
              ],
              remoteAudioLevels,
            },
          },
        };
        const action = groupCallAudioLevelsChange({
          callMode: CallMode.Group,
          conversationId: 'fake-group-call-conversation-id',
          localAudioLevel: 0.001,
          remoteDeviceStates,
        });

        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('updates the set of speaking participants, including yourself', () => {
        const action = groupCallAudioLevelsChange({
          callMode: CallMode.Group,
          conversationId: 'fake-group-call-conversation-id',
          localAudioLevel: 0.8,
          remoteDeviceStates,
        });
        const result = reducer(stateWithActiveGroupCall, action);

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.strictEqual(
          result.activeCallState?.localAudioLevel,
          truncateAudioLevel(0.8)
        );

        const call =
          result.callsByConversation['fake-group-call-conversation-id'];
        if (call?.callMode !== CallMode.Group) {
          throw new Error('Expected a group call to be found');
        }
        assert.deepStrictEqual(call.remoteAudioLevels, remoteAudioLevels);
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

      it('saves a new call to the map of conversations', () => {
        const result = reducer(
          getEmptyState(),
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joining,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              acis: [creatorAci],
              pendingAcis: [],
              creatorAci,
              eraId: 'xyz',
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
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
            localDemuxId: 1,
            peekInfo: {
              acis: [creatorAci],
              pendingAcis: [],
              creatorAci,
              eraId: 'xyz',
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
            raisedHands: [],
          }
        );
      });

      it('updates a call in the map of conversations', () => {
        const result = reducer(
          stateWithGroupCall,
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
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
            localDemuxId: 1,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
            raisedHands: [],
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
              ringerAci,
            },
          },
        };
        const result = reducer(
          state,
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
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
            ringerAci,
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
              ringerAci,
            },
          },
        };
        const result = reducer(
          state,
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            localDemuxId: 1,
            joinState: GroupCallJoinState.Joined,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
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
          'ringerAci'
        );
      });

      it("if no call is active, doesn't touch the active call state", () => {
        const result = reducer(
          stateWithGroupCall,
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: false,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
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
            callMode: CallMode.Group,
            conversationId: 'another-fake-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 16 / 9,
              },
            ],
          })
        );

        assert.deepEqual(result.activeCallState, {
          state: 'Active',
          callMode: CallMode.Group,
          conversationId: 'fake-group-call-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: false,
          localAudioLevel: 0,
          viewMode: CallViewMode.Paginated,
          showParticipantsList: false,
          outgoingRing: false,
          pip: false,
          settingsDialogOpen: false,
          joinedAt: null,
        } satisfies ActiveCallStateType);
      });

      it('if the call is active, updates the active call state', () => {
        const result = reducer(
          stateWithActiveGroupCall,
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 456,
                hasRemoteAudio: false,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
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
        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isTrue(result.activeCallState?.hasLocalAudio);
        assert.isTrue(result.activeCallState?.hasLocalVideo);
        assert.isNumber(result.activeCallState?.joinedAt);
      });

      it('keeps existing activeCallState.joinedAt', () => {
        const joinedAt = new Date().getTime() - 1000;
        const result = reducer(
          {
            ...stateWithActiveGroupCall,
            activeCallState: {
              ...stateWithActiveDirectCall.activeCallState,
              joinedAt,
            },
          },
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: [],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 0,
            },
            remoteParticipants: [],
          })
        );

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.equal(result.activeCallState?.joinedAt, joinedAt);
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
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: [],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 0,
            },
            remoteParticipants: [],
          })
        );

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isTrue(result.activeCallState?.outgoingRing);
      });

      it('stops ringing if someone enters the call', () => {
        const state: CallingStateType = {
          ...stateWithActiveGroupCall,
          activeCallState: {
            ...stateWithActiveGroupCall.activeCallState,
            outgoingRing: true,
          },
        };
        const result = reducer(
          state,
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [],
          })
        );

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isFalse(result.activeCallState?.outgoingRing);
      });

      it('mutes self in lobby when getting peek info with a lot of devices', () => {
        const result = reducer(
          {
            ...stateWithNotJoinedGroupCall,
            activeCallState: groupCallActiveCallState,
          },
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connecting,
            joinState: GroupCallJoinState.NotJoined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: Array(20).map(generateAci),
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 20,
            },
            remoteParticipants: [],
          })
        );

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isFalse(result.activeCallState?.hasLocalAudio);
      });

      it('does not mute self when getting peek info with few devices', () => {
        const result = reducer(
          {
            ...stateWithNotJoinedGroupCall,
            activeCallState: groupCallActiveCallState,
          },
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connecting,
            joinState: GroupCallJoinState.NotJoined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: [ACI_1],
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [],
          })
        );

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isTrue(result.activeCallState?.hasLocalAudio);
      });

      it('does not mute self when connected with many devices', () => {
        const result = reducer(
          stateWithActiveGroupCall,
          getAction({
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.Joined,
            localDemuxId: 1,
            hasLocalAudio: true,
            hasLocalVideo: true,
            peekInfo: {
              acis: Array(20).map(generateAci),
              pendingAcis: [],
              maxDevices: 16,
              deviceCount: 20,
            },
            remoteParticipants: [],
          })
        );

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isTrue(result.activeCallState?.hasLocalAudio);
      });
    });

    describe('handleCallLinkUpdate', () => {
      const { roomId, rootKey, adminKey } = FAKE_CALL_LINK;

      beforeEach(function (this: Mocha.Context) {
        this.callLinkRefreshJobQueueAdd = this.sandbox.stub(
          callLinkRefreshJobQueue,
          'add'
        );
      });

      const doAction = async (
        payload: HandleCallLinkUpdateType
      ): Promise<{ dispatch: sinon.SinonSpy }> => {
        const { handleCallLinkUpdate } = actions;
        const dispatch = sinon.spy();
        await handleCallLinkUpdate(payload)(dispatch, getEmptyRootState, null);
        return { dispatch };
      };

      it('queues call link refresh', async function (this: Mocha.Context) {
        await doAction({ rootKey, adminKey: null });

        sinon.assert.calledOnce(this.callLinkRefreshJobQueueAdd);
      });

      it('dispatches HANDLE_CALL_LINK_UPDATE', async () => {
        const { dispatch } = await doAction({ rootKey, adminKey: null });

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/HANDLE_CALL_LINK_UPDATE',
          payload: {
            callLink: {
              ...CALL_LINK_DEFAULT_STATE,
              roomId,
              rootKey,
              adminKey,
              storageID: undefined,
              storageVersion: undefined,
              storageUnknownFields: undefined,
              storageNeedsSync: false,
            },
          },
        });
      });

      it('can save adminKey', async () => {
        const { dispatch } = await doAction({ rootKey, adminKey: 'banana' });

        sinon.assert.calledOnce(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/HANDLE_CALL_LINK_UPDATE',
          payload: {
            callLink: {
              ...CALL_LINK_DEFAULT_STATE,
              roomId,
              rootKey,
              adminKey: 'banana',
              storageID: undefined,
              storageVersion: undefined,
              storageUnknownFields: undefined,
              storageNeedsSync: false,
            },
          },
        });
      });
    });

    describe('startCallLinkLobby', () => {
      const callLobbyData = {
        callMode: CallMode.Adhoc,
        connectionState: GroupCallConnectionState.NotConnected,
        hasLocalAudio: true,
        hasLocalVideo: true,
        joinState: GroupCallJoinState.NotJoined,
        peekInfo: [],
        remoteParticipants: [],
      };
      const callLinkState = getCallLinkState(FAKE_CALL_LINK);

      const getStateWithAdminKey = (): RootStateType => ({
        ...getEmptyRootState(),
        calling: {
          ...getEmptyState(),
          callLinks: {
            [FAKE_CALL_LINK_WITH_ADMIN_KEY.roomId]:
              FAKE_CALL_LINK_WITH_ADMIN_KEY,
          },
        },
      });

      beforeEach(function (this: Mocha.Context) {
        this.callingServiceReadCallLink = this.sandbox
          .stub(callingService, 'readCallLink')
          .resolves(callLinkState);
        this.callingServiceStartCallLinkLobby = this.sandbox
          .stub(callingService, 'startCallLinkLobby')
          .resolves(callLobbyData);
      });

      const doAction = async (
        payload: StartCallLinkLobbyType
      ): Promise<{ dispatch: sinon.SinonSpy }> => {
        const { startCallLinkLobby } = actions;
        const dispatch = sinon.spy();
        await startCallLinkLobby(payload)(dispatch, getEmptyRootState, null);
        return { dispatch };
      };

      it('reads the link and dispatches START_CALL_LINK_LOBBY', async function (this: Mocha.Context) {
        const { roomId, rootKey } = FAKE_CALL_LINK;
        const { dispatch } = await doAction({ rootKey });

        sinon.assert.calledTwice(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/WAITING_FOR_CALL_LINK_LOBBY',
          payload: {
            roomId,
          },
        });
        sinon.assert.calledWith(dispatch, {
          type: 'calling/START_CALL_LINK_LOBBY',
          payload: {
            ...callLobbyData,
            callLinkState,
            callLinkRoomId: roomId,
            callLinkRootKey: rootKey,
            conversationId: roomId,
            isConversationTooBigToRing: false,
          },
        });
      });

      it('preserves adminKey', () => {
        const { startCallLinkLobby } = actions;
        const { roomId, rootKey, adminKey } = FAKE_CALL_LINK_WITH_ADMIN_KEY;
        const dispatch = sinon.spy();
        const result = reducer(
          getStateWithAdminKey().calling,
          startCallLinkLobby({
            rootKey,
          })(
            dispatch,
            getStateWithAdminKey,
            null
          ) as unknown as Readonly<CallingActionType>
        );
        assert.equal(result.callLinks[roomId]?.adminKey, adminKey);
      });
    });

    describe('startCallLinkLobby for deleted links', () => {
      beforeEach(function (this: Mocha.Context) {
        this.callingServiceReadCallLink = this.sandbox
          .stub(callingService, 'readCallLink')
          .resolves(null);
      });

      const doAction = async (
        payload: StartCallLinkLobbyType
      ): Promise<{ dispatch: sinon.SinonSpy }> => {
        const { startCallLinkLobby } = actions;
        const dispatch = sinon.spy();
        await startCallLinkLobby(payload)(dispatch, getEmptyRootState, null);
        return { dispatch };
      };

      it('fails', async function (this: Mocha.Context) {
        const { roomId, rootKey } = FAKE_CALL_LINK;
        const { dispatch } = await doAction({ rootKey });

        sinon.assert.calledTwice(dispatch);
        sinon.assert.calledWith(dispatch, {
          type: 'calling/WAITING_FOR_CALL_LINK_LOBBY',
          payload: {
            roomId,
          },
        });
        sinon.assert.calledWith(dispatch, {
          type: 'calling/CALL_LOBBY_FAILED',
          payload: {
            conversationId: roomId,
          },
        });
      });
    });

    describe('peekNotConnectedGroupCall', () => {
      const { peekNotConnectedGroupCall } = actions;

      beforeEach(function (this: Mocha.Context) {
        this.callingServicePeekGroupCall = this.sandbox.stub(
          callingService,
          'peekGroupCall'
        );
        this.callingServiceUpdateCallHistoryForGroupCallOnPeek =
          this.sandbox.stub(
            callingService,
            'updateCallHistoryForGroupCallOnPeek'
          );
        this.clock = this.sandbox.useFakeTimers();
      });

      describe('thunk', () => {
        function noopTest(connectionState: GroupCallConnectionState) {
          return async function test(this: Mocha.Context) {
            const dispatch = sinon.spy();

            await peekNotConnectedGroupCall({
              callMode: CallMode.Group,
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
        const state: CallingStateType = {
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
          ringerAci,
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
          ringerAci,
        });
        const result = reducer(state, action);

        assert.strictEqual(result, state);
      });

      it('creates a new group call if one did not exist', () => {
        const action = receiveIncomingGroupCall({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(456),
          ringerAci,
        });
        const result = reducer(getEmptyState(), action);

        assert.deepEqual(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            callMode: CallMode.Group,
            conversationId: 'fake-group-call-conversation-id',
            connectionState: GroupCallConnectionState.NotConnected,
            joinState: GroupCallJoinState.NotJoined,
            localDemuxId: undefined,
            peekInfo: {
              acis: [],
              pendingAcis: [],
              maxDevices: Infinity,
              deviceCount: 0,
            },
            remoteParticipants: [],
            ringId: BigInt(456),
            ringerAci,
          }
        );
      });

      it('attaches ring state to an existing call', () => {
        const action = receiveIncomingGroupCall({
          conversationId: 'fake-group-call-conversation-id',
          ringId: BigInt(456),
          ringerAci,
        });
        const result = reducer(stateWithGroupCall, action);

        assert.include(
          result.callsByConversation['fake-group-call-conversation-id'],
          {
            ringId: BigInt(456),
            ringerAci,
          }
        );
      });
    });

    describe('receiveGroupCallReactions', () => {
      useFakeTimers();

      const { receiveGroupCallReactions } = actions;

      const getState = (): RootStateType => ({
        ...getEmptyRootState(),
        calling: {
          ...stateWithActiveGroupCall,
        },
      });

      function getAction(
        ...args: Parameters<typeof receiveGroupCallReactions>
      ): GroupCallReactionsReceivedActionType {
        const dispatch = sinon.spy();

        receiveGroupCallReactions(...args)(dispatch, getState, null);

        return dispatch.getCall(0).args[0];
      }

      it('adds reactions by timestamp', function (this: Mocha.Context) {
        const firstAction = getAction({
          callMode: CallMode.Group,
          conversationId: 'fake-group-call-conversation-id',
          reactions: [
            {
              demuxId: 123,
              value: '❤️',
            },
          ],
        });
        const firstResult = reducer(getState().calling, firstAction);

        strictAssert(
          firstResult.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.deepEqual(firstResult.activeCallState?.reactions, [
          {
            timestamp: NOW.getTime(),
            demuxId: 123,
            value: '❤️',
          },
        ]);

        const secondDate = new Date(NOW.getTime() + 1234);
        this.clock.restore();
        this.sandbox.useFakeTimers({ now: secondDate });
        const secondAction = getAction({
          callMode: CallMode.Group,
          conversationId: 'fake-group-call-conversation-id',
          reactions: [
            {
              demuxId: 456,
              value: '🎉',
            },
          ],
        });
        const secondResult = reducer(firstResult, secondAction);

        strictAssert(
          secondResult.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.deepEqual(secondResult.activeCallState?.reactions, [
          {
            timestamp: NOW.getTime(),
            demuxId: 123,
            value: '❤️',
          },
          {
            timestamp: secondDate.getTime(),
            demuxId: 456,
            value: '🎉',
          },
        ]);
      });

      it('sets multiple reactions with the same timestamp', () => {
        const action = getAction({
          callMode: CallMode.Group,
          conversationId: 'fake-group-call-conversation-id',
          reactions: [
            {
              demuxId: 123,
              value: '❤️',
            },
            {
              demuxId: 456,
              value: '🎉',
            },
          ],
        });
        const result = reducer(getState().calling, action);

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.deepEqual(result.activeCallState?.reactions, [
          {
            timestamp: NOW.getTime(),
            demuxId: 123,
            value: '❤️',
          },
          {
            timestamp: NOW.getTime(),
            demuxId: 456,
            value: '🎉',
          },
        ]);
      });
    });

    describe('sendGroupCallReactions', () => {
      useFakeTimers();

      beforeEach(function (this: Mocha.Context) {
        this.callingServiceSendGroupCallReaction = this.sandbox.stub(
          callingService,
          'sendGroupCallReaction'
        );
      });

      const { sendGroupCallReaction } = actions;

      const getState = (): RootStateType => ({
        ...getEmptyRootState(),
        calling: {
          ...stateWithActiveGroupCall,
        },
      });

      function getAction(
        ...args: Parameters<typeof sendGroupCallReaction>
      ): SendGroupCallReactionActionType {
        const dispatch = sinon.spy();

        sendGroupCallReaction(...args)(dispatch, getState, null);

        return dispatch.getCall(0).args[0];
      }

      it('adds a local copy', () => {
        const action = getAction({
          callMode: CallMode.Group,
          conversationId: 'fake-group-call-conversation-id',
          value: '❤️',
        });
        const result = reducer(getState().calling, action);

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.deepEqual(result.activeCallState?.reactions, [
          {
            timestamp: NOW.getTime(),
            demuxId: 1,
            value: '❤️',
          },
        ]);
      });
    });

    describe('setLocalAudio', () => {
      const { setLocalAudio } = actions;

      beforeEach(function (this: Mocha.Context) {
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

      it('updates the outgoing audio for the active call', function (this: Mocha.Context) {
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

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isFalse(result.activeCallState?.hasLocalAudio);
      });
    });

    describe('setOutgoingRing', () => {
      const { setOutgoingRing } = actions;

      it('enables a desire to ring', () => {
        const action = setOutgoingRing(true);
        const result = reducer(stateWithActiveGroupCall, action);

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isTrue(result.activeCallState?.outgoingRing);
      });

      it('disables a desire to ring', () => {
        const action = setOutgoingRing(false);
        const result = reducer(stateWithActiveDirectCall, action);

        strictAssert(
          result.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.isFalse(result.activeCallState?.outgoingRing);
      });
    });

    describe('startCallingLobby', () => {
      const { startCallingLobby } = actions;

      let rootState: RootStateType;
      let startCallingLobbyStub: sinon.SinonStub;

      beforeEach(function (this: Mocha.Context) {
        startCallingLobbyStub = this.sandbox
          .stub(callingService, 'startCallingLobby')
          .resolves();

        const emptyRootState = getEmptyRootState();
        rootState = {
          ...emptyRootState,
          conversations: {
            ...emptyRootState.conversations,
            conversationLookup: {
              'fake-conversation-id': getDefaultConversation(),
            },
          },
        };
      });

      describe('thunk', () => {
        it('asks the calling service to start the lobby', async () => {
          await startCallingLobby({
            conversationId: 'fake-conversation-id',
            isVideoCall: true,
          })(noop, () => rootState, null);

          sinon.assert.calledOnce(startCallingLobbyStub);
        });

        it('requests audio by default', async () => {
          await startCallingLobby({
            conversationId: 'fake-conversation-id',
            isVideoCall: true,
          })(noop, () => rootState, null);

          sinon.assert.calledWithMatch(startCallingLobbyStub, {
            hasLocalAudio: true,
          });
        });

        it("doesn't request audio if the group call already has 8 devices", async () => {
          await startCallingLobby({
            conversationId: 'fake-conversation-id',
            isVideoCall: true,
          })(
            noop,
            () => {
              const callingState = cloneDeep(stateWithGroupCall);
              const call = callingState.callsByConversation[
                'fake-group-call-conversation-id'
              ] as GroupCallStateType;
              const peekInfo = call.peekInfo as unknown as PeekInfo;
              peekInfo.deviceCount = 8;
              return { ...rootState, calling: callingState };
            },
            null
          );

          sinon.assert.calledWithMatch(startCallingLobbyStub, {
            hasLocalVideo: true,
          });
        });

        it('requests video when starting a video call', async () => {
          await startCallingLobby({
            conversationId: 'fake-conversation-id',
            isVideoCall: true,
          })(noop, () => rootState, null);

          sinon.assert.calledWithMatch(startCallingLobbyStub, {
            hasLocalVideo: true,
          });
        });

        it("doesn't request video when not a video call", async () => {
          await startCallingLobby({
            conversationId: 'fake-conversation-id',
            isVideoCall: false,
          })(noop, () => rootState, null);

          sinon.assert.calledWithMatch(startCallingLobbyStub, {
            hasLocalVideo: false,
          });
        });

        it('dispatches two actions if the calling lobby returns something', async () => {
          startCallingLobbyStub.resolves({
            callMode: CallMode.Direct,
            hasLocalAudio: true,
            hasLocalVideo: true,
          });

          const dispatch = sinon.stub();

          const conversationId = 'fake-conversation-id';
          await startCallingLobby({
            conversationId,
            isVideoCall: true,
          })(dispatch, () => rootState, null);

          sinon.assert.calledTwice(dispatch);

          sinon.assert.calledWith(dispatch, {
            type: 'calling/WAITING_FOR_CALLING_LOBBY',
            payload: {
              conversationId,
            },
          });
          sinon.assert.calledWith(dispatch, {
            type: 'calling/START_CALLING_LOBBY',
            payload: {
              callMode: 'Direct',
              hasLocalAudio: true,
              hasLocalVideo: true,
              conversationId,
              isConversationTooBigToRing: false,
            },
          });
        });

        it('dispatches two actions if the calling lobby returns nothing', async () => {
          const dispatch = sinon.stub();

          const conversationId = 'fake-conversation-id';
          await startCallingLobby({
            conversationId,
            isVideoCall: true,
          })(dispatch, () => rootState, null);

          sinon.assert.calledTwice(dispatch);

          sinon.assert.calledWith(dispatch, {
            type: 'calling/WAITING_FOR_CALLING_LOBBY',
            payload: {
              conversationId,
            },
          });
          sinon.assert.calledWith(dispatch, {
            type: 'calling/CALL_LOBBY_FAILED',
            payload: {
              conversationId,
            },
          });
        });
      });

      describe('action', () => {
        const getState = async (
          callingState: CallingStateType,
          callingServiceResult: UnwrapPromise<
            ReturnType<typeof callingService.startCallingLobby>
          >,
          conversationId = 'fake-conversation-id'
        ): Promise<CallingStateType> => {
          startCallingLobbyStub.resolves(callingServiceResult);

          const dispatch = sinon.stub();

          await startCallingLobby({
            conversationId,
            isVideoCall: true,
          })(dispatch, () => ({ ...rootState, calling: callingState }), null);

          const waitingAction = dispatch.getCall(0).args[0];
          assert.equal(waitingAction.type, 'calling/WAITING_FOR_CALLING_LOBBY');

          const action = dispatch.getCall(1).args[0];

          return reducer(callingState, action);
        };

        it('saves a direct call and makes it active', async () => {
          const result = await getState(getEmptyState(), {
            callMode: CallMode.Direct as const,
            hasLocalAudio: true,
            hasLocalVideo: true,
          });

          assert.deepEqual(result.callsByConversation['fake-conversation-id'], {
            callMode: CallMode.Direct,
            conversationId: 'fake-conversation-id',
            isIncoming: false,
            isVideoCall: true,
          });
          assert.deepEqual(result.activeCallState, {
            state: 'Active',
            callMode: CallMode.Direct,
            conversationId: 'fake-conversation-id',
            hasLocalAudio: true,
            hasLocalVideo: true,
            localAudioLevel: 0,
            viewMode: CallViewMode.Paginated,
            showParticipantsList: false,
            pip: false,
            settingsDialogOpen: false,
            outgoingRing: true,
            joinedAt: null,
          } satisfies ActiveCallStateType);
        });

        it('saves a group call and makes it active', async () => {
          const result = await getState(getEmptyState(), {
            callMode: CallMode.Group,
            hasLocalAudio: true,
            hasLocalVideo: true,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: {
              acis: [creatorAci],
              pendingAcis: [],
              creatorAci,
              eraId: 'xyz',
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          });

          assert.deepEqual(result.callsByConversation['fake-conversation-id'], {
            callMode: CallMode.Group,
            conversationId: 'fake-conversation-id',
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            localDemuxId: undefined,
            peekInfo: {
              acis: [creatorAci],
              pendingAcis: [],
              creatorAci,
              eraId: 'xyz',
              maxDevices: 16,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
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
          strictAssert(
            result.activeCallState?.state === 'Active',
            'state is active'
          );
          assert.isFalse(result.activeCallState?.outgoingRing);
        });

        it('chooses fallback peek info if none is sent and there is no existing call', async () => {
          const result = await getState(getEmptyState(), {
            callMode: CallMode.Group,
            hasLocalAudio: true,
            hasLocalVideo: true,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: undefined,
            remoteParticipants: [],
          });

          const call = result.callsByConversation['fake-conversation-id'];
          assert.deepEqual(call?.callMode === CallMode.Group && call.peekInfo, {
            acis: [],
            pendingAcis: [],
            maxDevices: Infinity,
            deviceCount: 0,
          });
        });

        it("doesn't overwrite an existing group call's peek info if none was sent", async () => {
          const result = await getState(stateWithGroupCall, {
            callMode: CallMode.Group,
            hasLocalAudio: true,
            hasLocalVideo: true,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: undefined,
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          });

          const call =
            result.callsByConversation['fake-group-call-conversation-id'];
          assert.deepEqual(call?.callMode === CallMode.Group && call.peekInfo, {
            acis: [creatorAci],
            pendingAcis: [],
            creatorAci,
            eraId: 'xyz',
            maxDevices: 16,
            deviceCount: 1,
          });
        });

        it("can overwrite an existing group call's peek info", async () => {
          const state = {
            ...getEmptyState(),
            callsByConversation: {
              'fake-conversation-id': {
                ...stateWithGroupCall.callsByConversation[
                  'fake-group-call-conversation-id'
                ],
                conversationId: 'fake-conversation-id',
              },
            },
          };

          const result = await getState(state, {
            callMode: CallMode.Group,
            hasLocalAudio: true,
            hasLocalVideo: true,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: {
              acis: [differentCreatorAci],
              pendingAcis: [],
              creatorAci: differentCreatorAci,
              eraId: 'abc',
              maxDevices: 5,
              deviceCount: 1,
            },
            remoteParticipants: [
              {
                aci: remoteAci,
                demuxId: 123,
                hasRemoteAudio: true,
                hasRemoteVideo: true,
                mediaKeysReceived: true,
                presenting: false,
                sharingScreen: false,
                videoAspectRatio: 4 / 3,
              },
            ],
          });

          const call = result.callsByConversation['fake-conversation-id'];
          assert.deepEqual(call?.callMode === CallMode.Group && call.peekInfo, {
            acis: [differentCreatorAci],
            pendingAcis: [],
            creatorAci: differentCreatorAci,
            eraId: 'abc',
            maxDevices: 5,
            deviceCount: 1,
          });
        });

        it("doesn't overwrite an existing group call's ring state if it was set previously", async () => {
          const result = await getState(
            {
              ...stateWithGroupCall,
              callsByConversation: {
                'fake-group-call-conversation-id': {
                  ...stateWithGroupCall.callsByConversation[
                    'fake-group-call-conversation-id'
                  ],
                  ringId: BigInt(987),
                  ringerAci,
                },
              },
            },
            {
              callMode: CallMode.Group,
              hasLocalAudio: true,
              hasLocalVideo: true,
              connectionState: GroupCallConnectionState.Connected,
              joinState: GroupCallJoinState.NotJoined,
              peekInfo: undefined,
              remoteParticipants: [
                {
                  aci: remoteAci,
                  demuxId: 123,
                  hasRemoteAudio: true,
                  hasRemoteVideo: true,
                  mediaKeysReceived: true,
                  presenting: false,
                  sharingScreen: false,
                  videoAspectRatio: 4 / 3,
                },
              ],
            }
          );
          const call =
            result.callsByConversation['fake-group-call-conversation-id'];
          // It'd be nice to do this with an assert, but Chai doesn't understand it.
          if (call?.callMode !== CallMode.Group) {
            throw new Error('Expected to find a group call');
          }

          assert.strictEqual(call.ringId, BigInt(987));
          assert.strictEqual(call.ringerAci, ringerAci);
        });

        it('enables outgoingRing for a group call when there is no existing call', async () => {
          const result = await getState(getEmptyState(), {
            callMode: CallMode.Group,
            hasLocalAudio: true,
            hasLocalVideo: true,
            connectionState: GroupCallConnectionState.Connected,
            joinState: GroupCallJoinState.NotJoined,
            peekInfo: undefined,
            remoteParticipants: [],
          });

          strictAssert(
            result.activeCallState?.state === 'Active',
            'state is active'
          );
          assert.isTrue(result.activeCallState?.outgoingRing);
        });
      });
    });

    describe('startCall', () => {
      const { startCall } = actions;

      beforeEach(function (this: Mocha.Context) {
        this.callingStartOutgoingDirectCall = this.sandbox.stub(
          callingService,
          'startOutgoingDirectCall'
        );
        this.callingJoinGroupCall = this.sandbox
          .stub(callingService, 'joinGroupCall')
          .resolves();
      });

      it('asks the calling service to start an outgoing direct call', async function (this: Mocha.Context) {
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

      it('asks the calling service to join a group call', async function (this: Mocha.Context) {
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

      it('saves direct calls and makes them active', async () => {
        const dispatch = sinon.spy();
        await startCall({
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
          state: 'Active',
          callMode: CallMode.Direct,
          conversationId: 'fake-conversation-id',
          hasLocalAudio: true,
          hasLocalVideo: false,
          localAudioLevel: 0,
          viewMode: CallViewMode.Paginated,
          showParticipantsList: false,
          pip: false,
          settingsDialogOpen: false,
          outgoingRing: true,
          joinedAt: null,
        });
      });

      it("doesn't dispatch any actions for group calls", async () => {
        const dispatch = sinon.spy();
        await startCall({
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

        strictAssert(
          afterOneToggle.activeCallState?.state === 'Active',
          'state is active #1'
        );
        assert.isTrue(afterOneToggle.activeCallState?.settingsDialogOpen);

        strictAssert(
          afterTwoToggles.activeCallState?.state === 'Active',
          'state is active #2'
        );
        assert.isFalse(afterTwoToggles.activeCallState?.settingsDialogOpen);

        strictAssert(
          afterThreeToggles.activeCallState?.state === 'Active',
          'state is active #3'
        );
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

        strictAssert(
          afterOneToggle.activeCallState?.state === 'Active',
          'state is active #1'
        );
        assert.isTrue(afterOneToggle.activeCallState?.showParticipantsList);

        strictAssert(
          afterTwoToggles.activeCallState?.state === 'Active',
          'state is active #2'
        );
        assert.isFalse(afterTwoToggles.activeCallState?.showParticipantsList);

        strictAssert(
          afterThreeToggles.activeCallState?.state === 'Active',
          'state is active #3'
        );
        assert.isTrue(afterThreeToggles.activeCallState?.showParticipantsList);
      });
    });

    describe('togglePip', () => {
      const { togglePip } = actions;

      it('toggles the PiP', () => {
        const afterOneToggle = reducer(stateWithActiveDirectCall, togglePip());
        const afterTwoToggles = reducer(afterOneToggle, togglePip());
        const afterThreeToggles = reducer(afterTwoToggles, togglePip());

        strictAssert(
          afterOneToggle.activeCallState?.state === 'Active',
          'state is active #1'
        );
        assert.isTrue(afterOneToggle.activeCallState?.pip);

        strictAssert(
          afterTwoToggles.activeCallState?.state === 'Active',
          'state is active #2'
        );
        assert.isFalse(afterTwoToggles.activeCallState?.pip);

        strictAssert(
          afterThreeToggles.activeCallState?.state === 'Active',
          'state is active #3'
        );
        assert.isTrue(afterThreeToggles.activeCallState?.pip);
      });
    });

    describe('switchToPresentationView', () => {
      const {
        switchToPresentationView,
        switchFromPresentationView,
        changeCallView,
      } = actions;

      it('toggles presentation view from paginated view', () => {
        const afterOneToggle = reducer(
          stateWithActiveGroupCall,
          switchToPresentationView()
        );
        const afterTwoToggles = reducer(
          afterOneToggle,
          switchToPresentationView()
        );
        const afterThreeToggles = reducer(
          afterOneToggle,
          switchFromPresentationView()
        );

        strictAssert(
          afterOneToggle.activeCallState?.state === 'Active',
          'state is active #1'
        );
        assert.strictEqual(
          afterOneToggle.activeCallState?.viewMode,
          CallViewMode.Presentation
        );

        strictAssert(
          afterTwoToggles.activeCallState?.state === 'Active',
          'state is active #2'
        );
        assert.strictEqual(
          afterTwoToggles.activeCallState?.viewMode,
          CallViewMode.Presentation
        );

        strictAssert(
          afterThreeToggles.activeCallState?.state === 'Active',
          'state is active #3'
        );
        assert.strictEqual(
          afterThreeToggles.activeCallState?.viewMode,
          CallViewMode.Paginated
        );
      });

      it('switches to previously selected view after presentation', () => {
        const stateOverflow = reducer(
          stateWithActiveGroupCall,
          changeCallView(CallViewMode.Sidebar)
        );
        const statePresentation = reducer(
          stateOverflow,
          switchToPresentationView()
        );
        const stateAfterPresentation = reducer(
          statePresentation,
          switchFromPresentationView()
        );

        strictAssert(
          stateAfterPresentation.activeCallState?.state === 'Active',
          'state is active'
        );
        assert.strictEqual(
          stateAfterPresentation.activeCallState?.viewMode,
          CallViewMode.Sidebar
        );
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
      it('returns false with no peek info', () => {
        assert.isFalse(isAnybodyElseInGroupCall(undefined, remoteAci));
      });

      it('returns false if the peek info has no participants', () => {
        assert.isFalse(isAnybodyElseInGroupCall({ acis: [] }, remoteAci));
      });

      it('returns false if the peek info has one participant, you', () => {
        assert.isFalse(
          isAnybodyElseInGroupCall({ acis: [creatorAci] }, creatorAci)
        );
      });

      it('returns true if the peek info has one participant, someone else', () => {
        assert.isTrue(
          isAnybodyElseInGroupCall({ acis: [creatorAci] }, remoteAci)
        );
      });

      it('returns true if the peek info has two participants, you and someone else', () => {
        assert.isTrue(
          isAnybodyElseInGroupCall({ acis: [creatorAci, remoteAci] }, remoteAci)
        );
      });
    });
  });
});
