// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';

import { CallingStateType, DirectCallStateType } from '../ducks/calling';
import { CallMode, CallState } from '../../types/Calling';

const getCallsByConversation = (state: CallingStateType) =>
  state.callsByConversation;

// In theory, there could be multiple incoming calls. In practice, neither RingRTC nor the
//   UI are ready to handle this.
export const getIncomingCall = createSelector(
  getCallsByConversation,
  (callsByConversation): undefined | DirectCallStateType => {
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
