// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { StateType } from '../reducer';
import type {
  ActiveCallStateType,
  CallingStateType,
  CallsByConversationType,
  DirectCallStateType,
  GroupCallStateType,
} from '../ducks/calling';
import { getIncomingCall as getIncomingCallHelper } from '../ducks/calling';
import { getUserACI } from './user';
import { getOwn } from '../../util/getOwn';
import { CallViewMode } from '../../types/Calling';
import type { UUIDStringType } from '../../types/UUID';

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
  (callsByConversation: CallsByConversationType): CallSelectorType =>
    (conversationId: string) =>
      getOwn(callsByConversation, conversationId)
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
    ourUuid: UUIDStringType | undefined
  ): undefined | DirectCallStateType | GroupCallStateType => {
    if (!ourUuid) {
      return undefined;
    }

    return getIncomingCallHelper(callsByConversation, ourUuid);
  }
);

export const isInSpeakerView = (
  call: Pick<ActiveCallStateType, 'viewMode'> | undefined
): boolean => {
  return Boolean(
    call?.viewMode === CallViewMode.Presentation ||
      call?.viewMode === CallViewMode.Speaker
  );
};
