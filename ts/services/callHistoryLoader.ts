// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader, DataWriter } from '../sql/Client';
import type { CallHistoryDetails } from '../types/CallDisposition';
import { strictAssert } from '../util/assert';

let callsHistoryData: ReadonlyArray<CallHistoryDetails>;
let callsHistoryUnreadCount: number;

export async function loadCallHistory(): Promise<void> {
  await DataWriter.cleanupCallHistoryMessages();
  callsHistoryData = await DataReader.getAllCallHistory();
  callsHistoryUnreadCount = await DataReader.getCallHistoryUnreadCount();
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
