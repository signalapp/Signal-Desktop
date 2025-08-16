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
  ActiveCallStateType,
} from '../ducks/calling';
import { getRingingCall as getRingingCallHelper } from '../ducks/callingHelpers';
import type { PresentedSource } from '../../types/Calling';
import { CallMode } from '../../types/CallDisposition';
import { isCallLinkAdmin, type CallLinkType } from '../../types/CallLink';
import { getUserACI } from './user';
import { getOwn } from '../../util/getOwn';
import type { AciString } from '../../types/ServiceId';

export type CallStateType = DirectCallStateType | GroupCallStateType;

const getCalling = (state: StateType): CallingStateType => state.calling;

export const getAvailableMicrophones = createSelector(
  getCalling,
  ({ availableMicrophones }) => availableMicrophones
);

export const getSelectedMicrophone = createSelector(
  getCalling,
  ({ selectedMicrophone }) => selectedMicrophone
);

export const getAvailableSpeakers = createSelector(
  getCalling,
  ({ availableSpeakers }) => availableSpeakers
);

export const getSelectedSpeaker = createSelector(
  getCalling,
  ({ selectedSpeaker }) => selectedSpeaker
);

export const getAvailableCameras = createSelector(
  getCalling,
  ({ availableCameras }) => availableCameras
);

export const getSelectedCamera = createSelector(
  getCalling,
  ({ selectedCamera }) => selectedCamera
);

export const getActiveCallState = createSelector(
  getCalling,
  (state: CallingStateType) => {
    if (state.activeCallState?.state !== 'Active') {
      return undefined;
    }

    return state.activeCallState;
  }
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
    (roomId: string): CallLinkType | undefined =>
      getOwn(callLinksByRoomId, roomId)
);

export const getAllCallLinks = createSelector(
  getCallLinksByRoomId,
  (lookup): Array<CallLinkType> => Object.values(lookup)
);

export const getHasAnyAdminCallLinks = createSelector(
  getAllCallLinks,
  (callLinks): boolean => callLinks.some(callLink => isCallLinkAdmin(callLink))
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
  getActiveCallState,
  (activeCallState: undefined | ActiveCallStateType): boolean =>
    Boolean(activeCallState && !activeCallState.pip)
);

export const getRingingCall = createSelector(
  getCallsByConversation,
  getActiveCallState,
  getUserACI,
  (
    callsByConversation: CallsByConversationType,
    activeCallState: ActiveCallStateType | undefined,
    ourAci: AciString | undefined
  ): undefined | DirectCallStateType | GroupCallStateType => {
    if (!ourAci) {
      return undefined;
    }

    return getRingingCallHelper(callsByConversation, activeCallState, ourAci);
  }
);

export const areAnyCallsActiveOrRinging = createSelector(
  getActiveCall,
  getRingingCall,
  (activeCall, ringingCall): boolean => Boolean(activeCall || ringingCall)
);

export const getPresentingSource = createSelector(
  getActiveCallState,
  (activeCallState): PresentedSource | undefined =>
    activeCallState?.presentingSource
);
