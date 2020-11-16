// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { CallingStateType } from '../ducks/calling';
import { CallState } from '../../types/Calling';
import { getOwn } from '../../util/getOwn';

const getActiveCallState = (state: CallingStateType) => state.activeCallState;

const getCallsByConversation = (state: CallingStateType) =>
  state.callsByConversation;

// In theory, there could be multiple incoming calls. In practice, neither RingRTC nor the
//   UI are ready to handle this.
export const getIncomingCall = createSelector(
  getCallsByConversation,
  callsByConversation =>
    Object.values(callsByConversation).find(
      call => call.isIncoming && call.callState === CallState.Ringing
    )
);

export const getActiveCall = createSelector(
  getActiveCallState,
  getCallsByConversation,
  (activeCallState, callsByConversation) =>
    activeCallState &&
    getOwn(callsByConversation, activeCallState.conversationId)
);

export const isCallActive = createSelector(getActiveCall, Boolean);
