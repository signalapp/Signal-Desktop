// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Calling selectors removed - stub only

export type CallSelectorType = (_conversationId: string) => {};
export type CallStateType = {};

export const getActiveCall = (_state: unknown) => ({});
export const getActiveCallState = (_state: unknown) => ({});
export const getIncomingCall = (_state: unknown) => undefined;
export const areAnyCallsActiveOrRinging = (_state: unknown) => false;
export const isInFullScreenCall = (_state: unknown) => false;
export const isInCall = (_state: unknown) => false;
export const getCallSelector = (_state: unknown): CallSelectorType => {
  return (_conversationId: string) => ({});
};
