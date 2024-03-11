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
    try {
      await window.Signal.Data.clearCallHistory(timestamp);
    } finally {
      // We want to reset the call history even if the clear fails.
      window.reduxActions.callHistory.resetCallHistory();
    }
    confirm();
  } else if (event === CallLogEvent.MarkedAsRead) {
    log.info(
      `onCallLogEventSync: Marking call history read before ${timestamp}`
    );
    try {
      await window.Signal.Data.markAllCallHistoryRead(timestamp);
    } finally {
      window.reduxActions.callHistory.updateCallHistoryUnreadCount();
    }
    confirm();
  } else {
    throw missingCaseError(event);
  }
}
