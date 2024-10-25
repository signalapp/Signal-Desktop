// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { reducer as rootReducer } from '../../../state/reducer';
import { noopAction } from '../../../state/ducks/noop';
import { actions as userActions } from '../../../state/ducks/user';
import {
  CallState,
  CallViewMode,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../../../types/Calling';
import { CallMode } from '../../../types/CallDisposition';
import { generateAci } from '../../../types/ServiceId';
import {
  getCallsByConversation,
  getCallSelector,
  getHasAnyAdminCallLinks,
  getRingingCall,
  isInCall,
} from '../../../state/selectors/calling';
import type {
  CallingStateType,
  DirectCallStateType,
  GroupCallStateType,
} from '../../../state/ducks/calling';
import { getEmptyState } from '../../../state/ducks/calling';
import {
  FAKE_CALL_LINK,
  FAKE_CALL_LINK_WITH_ADMIN_KEY,
} from '../../../test-both/helpers/fakeCallLink';

const OUR_ACI = generateAci();
const ACI_1 = generateAci();

describe('state/selectors/calling', () => {
  const getEmptyRootState = () => {
    const initial = rootReducer(undefined, noopAction());
    return rootReducer(
      initial,
      userActions.userChanged({
        ourAci: OUR_ACI,
      })
    );
  };

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
      state: 'Active',
      callMode: CallMode.Direct,
      conversationId: 'fake-direct-call-conversation-id',
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

  const incomingDirectCall: DirectCallStateType = {
    callMode: CallMode.Direct,
    conversationId: 'fake-direct-call-conversation-id',
    callState: CallState.Ringing,
    isIncoming: true,
    isVideoCall: false,
    hasRemoteVideo: false,
  };

  const stateWithIncomingDirectCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-direct-call-conversation-id': incomingDirectCall,
    },
  };

  const incomingGroupCall: GroupCallStateType = {
    callMode: CallMode.Group,
    conversationId: 'fake-group-call-conversation-id',
    connectionState: GroupCallConnectionState.NotConnected,
    joinState: GroupCallJoinState.NotJoined,
    localDemuxId: undefined,
    peekInfo: {
      acis: [ACI_1],
      pendingAcis: [],
      creatorAci: ACI_1,
      maxDevices: Infinity,
      deviceCount: 1,
    },
    remoteParticipants: [],
    ringId: BigInt(123),
    ringerAci: ACI_1,
  };

  const stateWithIncomingGroupCall: CallingStateType = {
    ...getEmptyState(),
    callsByConversation: {
      'fake-group-call-conversation-id': incomingGroupCall,
    },
  };

  const stateWithCallLink: CallingStateType = {
    ...getEmptyState(),
    callLinks: {
      [FAKE_CALL_LINK.roomId]: FAKE_CALL_LINK,
    },
  };

  const stateWithAdminCallLink: CallingStateType = {
    ...getEmptyState(),
    callLinks: {
      [FAKE_CALL_LINK_WITH_ADMIN_KEY.roomId]: FAKE_CALL_LINK_WITH_ADMIN_KEY,
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

  describe('getRingingCall', () => {
    it('returns undefined if there are no calls', () => {
      assert.isUndefined(getRingingCall(getEmptyRootState()));
    });

    it('returns undefined if there is no incoming call', () => {
      assert.isUndefined(getRingingCall(getCallingState(stateWithDirectCall)));
      assert.isUndefined(
        getRingingCall(getCallingState(stateWithActiveDirectCall))
      );
    });

    it('returns undefined if there is a group call with no peeked participants', () => {
      const state = {
        ...stateWithIncomingGroupCall,
        callsByConversation: {
          'fake-group-call-conversation-id': {
            ...incomingGroupCall,
            peekInfo: {
              acis: [],
              pendingAcis: [],
              maxDevices: Infinity,
              deviceCount: 1,
            },
          },
        },
      };

      assert.isUndefined(getRingingCall(getCallingState(state)));
    });

    it('returns an incoming direct call', () => {
      assert.deepEqual(
        getRingingCall(getCallingState(stateWithIncomingDirectCall)),
        incomingDirectCall
      );
    });

    it('returns an incoming group call', () => {
      assert.deepEqual(
        getRingingCall(getCallingState(stateWithIncomingGroupCall)),
        incomingGroupCall
      );
    });
  });

  describe('isInCall', () => {
    it('returns should be false if we are not in a call', () => {
      assert.isFalse(isInCall(getEmptyRootState()));
    });

    it('should be true if we are in a call', () => {
      assert.isTrue(isInCall(getCallingState(stateWithActiveDirectCall)));
    });
  });

  describe('getHasAnyAdminCallLinks', () => {
    it('returns true with admin call links', () => {
      assert.isTrue(
        getHasAnyAdminCallLinks(getCallingState(stateWithAdminCallLink))
      );
    });

    it('returns false with only non-admin call links', () => {
      assert.isFalse(
        getHasAnyAdminCallLinks(getCallingState(stateWithCallLink))
      );
    });

    it('returns false without any call links', () => {
      assert.isFalse(getHasAnyAdminCallLinks(getEmptyRootState()));
    });
  });
});
