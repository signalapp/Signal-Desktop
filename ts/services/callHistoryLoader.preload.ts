// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader, DataWriter } from '../sql/Client.preload.ts';
import type { CallHistoryDetails } from '../types/CallDisposition.std.ts';
import { strictAssert } from '../util/assert.std.ts';

let callsHistoryData: ReadonlyArray<CallHistoryDetails>;
let callsHistoryUnreadCountsByConversationId: Record<string, number>;

export async function loadCallHistory(): Promise<void> {
  await DataWriter.cleanupCallHistoryMessages();
  callsHistoryData = await DataReader.getAllCallHistory();
  callsHistoryUnreadCountsByConversationId =
    await DataReader.getCallHistoryUnreadCountsByConversationId();
}

export function getCallsHistoryForRedux(): ReadonlyArray<CallHistoryDetails> {
  strictAssert(callsHistoryData != null, 'callHistory has not been loaded');
  return callsHistoryData;
}

export function getCallsHistoryUnreadCountsByConversationIdForRedux(): Record<
  string,
  number
> {
  strictAssert(
    callsHistoryUnreadCountsByConversationId != null,
    'callHistory has not been loaded'
  );
  return callsHistoryUnreadCountsByConversationId;
}
