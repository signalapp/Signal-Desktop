// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type {
  CallingStateType,
  CallsByConversationType,
  AdhocCallsType,
  CallLinksByRoomIdType,
  DirectCallStateType,
  GroupCallStateType,
} from '../ducks/calling';
import { getIncomingCall as getIncomingCallHelper } from '../ducks/callingHelpers';
import { CallMode } from '../../types/Calling';
import type { CallLinkType } from '../../types/CallLink';
import { getUserACI } from './user';
import { getOwn } from '../../util/getOwn';
import type { AciString } from '../../types/ServiceId';

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

export const getAdhocCalls = createSelector(
  getCalling,
  (state: CallingStateType): AdhocCallsType => state.adhocCalls
);

export const getCallLinksByRoomId = createSelector(
  getCalling,
  (state: CallingStateType): CallLinksByRoomIdType => state.callLinks
);

export type CallLinkSelectorType = (roomId: string) => CallLinkType | undefined;

export const getCallLinkSelector = createSelector(
  getCallLinksByRoomId,
  (callLinksByRoomId: CallLinksByRoomIdType): CallLinkSelectorType =>
    (roomId: string): CallLinkType | undefined => {
      const callLinkState = getOwn(callLinksByRoomId, roomId);
      if (!callLinkState) {
        return;
      }

      const { name, restrictions, rootKey, expiration } = callLinkState;
      return {
        roomId,
        name,
        restrictions,
        rootKey,
        expiration,
      };
    }
);

export type CallSelectorType = (
  conversationId: string
) => CallStateType | undefined;
export const getCallSelector = createSelector(
  getCallsByConversation,
  (callsByConversation: CallsByConversationType): CallSelectorType =>
    (conversationId: string) =>
      getOwn(callsByConversation, conversationId)
);

export type AdhocCallSelectorType = (
  conversationId: string
) => GroupCallStateType | undefined;
export const getAdhocCallSelector = createSelector(
  getAdhocCalls,
  (adhocCalls: AdhocCallsType): AdhocCallSelectorType =>
    (roomId: string) =>
      getOwn(adhocCalls, roomId)
);

export const getActiveCall = createSelector(
  getActiveCallState,
  getCallSelector,
  getAdhocCallSelector,
  (
    activeCallState,
    callSelector,
    adhocCallSelector
  ): undefined | CallStateType => {
    const { callMode, conversationId } = activeCallState || {};
    if (!conversationId) {
      return undefined;
    }

    return callMode === CallMode.Adhoc
      ? adhocCallSelector(conversationId)
      : callSelector(conversationId);
  }
);

export const isInCall = createSelector(
  getActiveCall,
  (call: CallStateType | undefined): boolean => Boolean(call)
);

export const isInFullScreenCall = createSelector(
  getCalling,
  (state: CallingStateType): boolean =>
    Boolean(state.activeCallState && !state.activeCallState.pip)
);

export const getIncomingCall = createSelector(
  getCallsByConversation,
  getUserACI,
  (
    callsByConversation: CallsByConversationType,
    ourAci: AciString | undefined
  ): undefined | DirectCallStateType | GroupCallStateType => {
    if (!ourAci) {
      return undefined;
    }

    return getIncomingCallHelper(callsByConversation, ourAci);
  }
);

export const areAnyCallsActiveOrRinging = createSelector(
  getActiveCall,
  getIncomingCall,
  (activeCall, incomingCall): boolean => Boolean(activeCall || incomingCall)
);
