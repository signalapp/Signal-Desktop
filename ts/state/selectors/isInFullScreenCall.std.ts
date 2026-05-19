// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import type { CallingStateType } from '../ducks/calling.preload.ts';
import type { StateType } from '../reducer.preload.ts';
import { CallState } from '../../types/Calling.std.ts';
import { CallMode } from '../../types/CallDisposition.std.ts';

// Imported by both calling and user selectors; split out to avoid circular imports
export const getIsInFullScreenCall = createSelector(
  (state: StateType): CallingStateType => state.calling,
  ({ activeCallState, callsByConversation }: CallingStateType): boolean => {
    if (activeCallState?.state !== 'Active' || activeCallState.pip) {
      return false;
    }
    if (activeCallState.callMode !== CallMode.Direct) {
      return true;
    }
    const call = callsByConversation[activeCallState.conversationId];
    // Matches logic in SmartCallManager's mapStateToActiveCall: we may have an active
    // call but not be showing the call screen (e.g. after clicking Accept on an incoming
    // direct call but before RingRTC has updated the call state)
    if (
      call?.callMode === CallMode.Direct &&
      call.isIncoming &&
      (call.callState === CallState.Prering ||
        call.callState === CallState.Ringing)
    ) {
      return false;
    }
    return true;
  }
);
