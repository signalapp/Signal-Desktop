// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import dataInterface from '../sql/Client';
import type { CallHistoryDetails } from '../types/CallDisposition';
import { strictAssert } from '../util/assert';

let callsHistoryData: ReadonlyArray<CallHistoryDetails>;
let callsHistoryUnreadCount: number;

export async function loadCallsHistory(): Promise<void> {
  await dataInterface.cleanupCallHistoryMessages();
  callsHistoryData = await dataInterface.getAllCallHistory();
  callsHistoryUnreadCount = await dataInterface.getCallHistoryUnreadCount();
}

export function getCallsHistoryForRedux(): ReadonlyArray<CallHistoryDetails> {
  strictAssert(callsHistoryData != null, 'callHistory has not been loaded');
  return callsHistoryData;
}

export function getCallsHistoryUnreadCountForRedux(): number {
  strictAssert(
    callsHistoryUnreadCount != null,
    'callHistory has not been loaded'
  );
  return callsHistoryUnreadCount;
}
