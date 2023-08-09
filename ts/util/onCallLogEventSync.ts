// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallLogEventSyncEvent } from '../textsecure/messageReceiverEvents';
import * as log from '../logging/log';
import { CallLogEvent } from '../types/CallDisposition';
import { missingCaseError } from './missingCaseError';

export async function onCallLogEventSync(
  syncEvent: CallLogEventSyncEvent
): Promise<void> {
  const { callLogEvent, confirm } = syncEvent;
  const { event, timestamp } = callLogEvent;

  log.info(
    `onCallLogEventSync: Processing event (Event: ${event}, Timestamp: ${timestamp})`
  );

  if (event === CallLogEvent.Clear) {
    log.info(`onCallLogEventSync: Clearing call history before ${timestamp}`);
    await window.Signal.Data.clearCallHistory(timestamp);
    confirm();
  } else {
    throw missingCaseError(event);
  }
}
