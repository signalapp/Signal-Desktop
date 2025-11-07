// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallHistory feature removed - stub only

import type { NoopActionType } from './noop.std.js';

export type CallHistoryState = Record<string, never>;

const initialState: CallHistoryState = {};

export const actions = {
  updateCallHistoryUnreadCount: () => ({ type: 'callHistory/NOOP' as const }),
};

export const reducer = (
  state: CallHistoryState = initialState,
  action: NoopActionType
): CallHistoryState => {
  return state;
};
