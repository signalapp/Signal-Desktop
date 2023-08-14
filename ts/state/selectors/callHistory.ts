// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createSelector } from 'reselect';
import type { CallHistoryState } from '../ducks/callHistory';
import type { StateType } from '../reducer';
import type { CallHistoryDetails } from '../../types/CallDisposition';
import { getOwn } from '../../util/getOwn';

const getCallHistory = (state: StateType): CallHistoryState =>
  state.callHistory;

export const getCallHistoryEdition = createSelector(
  getCallHistory,
  callHistory => {
    return callHistory.edition;
  }
);

export type CallHistorySelectorType = (
  callId: string
) => CallHistoryDetails | void;

export const getCallHistorySelector = createSelector(
  getCallHistory,
  (callHistory): CallHistorySelectorType => {
    return callId => {
      return getOwn(callHistory.callHistoryByCallId, callId);
    };
  }
);

export const getCallHistoryUnreadCount = createSelector(
  getCallHistory,
  callHistory => {
    return callHistory.unreadCount;
  }
);
