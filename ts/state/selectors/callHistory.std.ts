// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallHistory selectors removed - stub only

export type CallHistorySelectorType = (_callId: string) => undefined;

export const getCallHistoryUnreadCount = (_state: unknown) => 0;
export const getCallHistoryEdition = (_state: unknown) => 0;
export const getCallHistorySelector = (_state: unknown): CallHistorySelectorType => {
  return (_callId: string) => undefined;
};
