// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { StateType } from '../reducer';
import {
  CallingStateType,
  CallsByConversationType,
  DirectCallStateType,
  GroupCallStateType,
  isAnybodyElseInGroupCall,
} from '../ducks/calling';
import {
  CallMode,
  CallState,
  GroupCallConnectionState,
} from '../../types/Calling';
import { getUserUuid } from './user';
import { getOwn } from '../../util/getOwn';
import { missingCaseError } from '../../util/missingCaseError';

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

// In theory, there could be multiple incoming calls, or an incoming call while there's
//   an active call. In practice, the UI is not ready for this, and RingRTC doesn't
//   support it for direct calls.
export const getIncomingCall = createSelector(
  getCallsByConversation,
  getUserUuid,
  (
    callsByConversation: CallsByConversationType,
    ourUuid: string
  ): undefined | DirectCallStateType | GroupCallStateType => {
    return Object.values(callsByConversation).find(call => {
      switch (call.callMode) {
        case CallMode.Direct:
          return call.isIncoming && call.callState === CallState.Ringing;
        case CallMode.Group:
          return (
            call.ringerUuid &&
            call.connectionState === GroupCallConnectionState.NotConnected &&
            isAnybodyElseInGroupCall(call.peekInfo, ourUuid)
          );
        default:
          throw missingCaseError(call);
      }
    });
  }
);
