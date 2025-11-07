// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Calling feature removed - stub only

import type { NoopActionType } from './noop.std.js';

export type CallingStateType = Record<string, never>;

const initialState: CallingStateType = {};

const noop = (..._args: Array<unknown>): void => {
  // No-op
};

export const actions = {
  hangupAllCalls: (..._args: Array<unknown>) => ({ type: 'calling/NOOP' as const }),
  hangUpActiveCall: (..._args: Array<unknown>) => ({ type: 'calling/NOOP' as const }),
  peekNotConnectedGroupCall: (..._args: Array<unknown>) => ({ type: 'calling/NOOP' as const }),
  onOutgoingAudioCallInConversation: noop,
  onOutgoingVideoCallInConversation: noop,
  returnToActiveCall: noop,
  startCallingLobby: noop,
  cancelPresenting: noop,
};

export function useCallingActions(): typeof actions {
  return actions;
}

export const reducer = (
  state: CallingStateType = initialState,
  action: NoopActionType
): CallingStateType => {
  return state;
};
