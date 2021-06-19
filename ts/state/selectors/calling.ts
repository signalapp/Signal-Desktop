// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  CallingStateType,
  CallsByConversationType,
  DirectCallStateType,
  GroupCallStateType,
} from '../ducks/calling';
import { CallMode, CallState } from '../../types/Calling';
import { getOwn } from '../../util/getOwn';

export type CallStateType = DirectCallStateType | GroupCallStateType;

const getCalling = (state: StateType): CallingStateType => state.calling;

export const getActiveCallState = createSelector(
  getCalling,
  (state: CallingStateType) => state.activeCallState
);

export const getCallsByConversation = createSelector(
  getCalling,
  (state: CallingStateType): CallsByConversationType =>
    state.callsByConversation
);

export type CallSelectorType = (
  conversationId: string
) => CallStateType | undefined;
export const getCallSelector = createSelector(
  getCallsByConversation,
  (callsByConversation: CallsByConversationType): CallSelectorType => (
    conversationId: string
  ) => getOwn(callsByConversation, conversationId)
);

export const getActiveCall = createSelector(
  getActiveCallState,
  getCallSelector,
  (activeCallState, callSelector): undefined | CallStateType => {
    if (activeCallState && activeCallState.conversationId) {
      return callSelector(activeCallState.conversationId);
    }

    return undefined;
  }
);

export const isInCall = createSelector(
  getActiveCall,
  (call: CallStateType | undefined): boolean => Boolean(call)
);

// In theory, there could be multiple incoming calls. In practice, neither RingRTC nor the
//   UI are ready to handle this.
export const getIncomingCall = createSelector(
  getCallsByConversation,
  (
    callsByConversation: CallsByConversationType
  ): undefined | DirectCallStateType => {
    const result = Object.values(callsByConversation).find(
      call =>
        call.callMode === CallMode.Direct &&
        call.isIncoming &&
        call.callState === CallState.Ringing
    );
    // TypeScript needs a little help to be sure that this is a direct call.
    return result?.callMode === CallMode.Direct ? result : undefined;
  }
);
