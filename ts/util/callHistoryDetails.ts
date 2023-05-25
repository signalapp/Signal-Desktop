// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallHistoryDetailsFromDiskType } from '../types/Calling';
import { CallMode } from '../types/Calling';
import type { LoggerType } from '../types/Logging';
import { strictAssert } from './assert';
import { missingCaseError } from './missingCaseError';

enum CallHistoryStatus {
  Pending = 'Pending',
  Missed = 'Missed',
  Accepted = 'Accepted',
  NotAccepted = 'NotAccepted',
}

function getCallHistoryStatus(
  callHistoryDetails: CallHistoryDetailsFromDiskType
): CallHistoryStatus {
  strictAssert(
    callHistoryDetails.callMode === CallMode.Direct,
    "Can't get call history status for group call (unimplemented)"
  );
  if (callHistoryDetails.acceptedTime != null) {
    return CallHistoryStatus.Accepted;
  }
  if (callHistoryDetails.wasDeclined) {
    return CallHistoryStatus.NotAccepted;
  }
  if (callHistoryDetails.endedTime != null) {
    return CallHistoryStatus.Missed;
  }
  return CallHistoryStatus.Pending;
}

function isAllowedTransition(
  from: CallHistoryStatus,
  to: CallHistoryStatus,
  log: LoggerType
): boolean {
  if (from === CallHistoryStatus.Pending) {
    log.info('callHistoryDetails: Can go from pending to anything.');
    return true;
  }
  if (to === CallHistoryStatus.Pending) {
    log.info("callHistoryDetails: Can't go to pending once out of it.");
    return false;
  }
  if (from === CallHistoryStatus.Missed) {
    log.info(
      "callHistoryDetails: A missed call on this device might've been picked up or explicitly declined on a linked device."
    );
    return true;
  }
  if (from === CallHistoryStatus.Accepted) {
    log.info(
      'callHistoryDetails: If we accept anywhere that beats everything.'
    );
    return false;
  }
  if (
    from === CallHistoryStatus.NotAccepted &&
    to === CallHistoryStatus.Accepted
  ) {
    log.info(
      'callHistoryDetails: If we declined on this device but picked up on another device, that counts as accepted.'
    );
    return true;
  }

  if (from === CallHistoryStatus.NotAccepted) {
    log.info(
      "callHistoryDetails: Can't transition from NotAccepted to anything else"
    );
    return false;
  }

  throw missingCaseError(from);
}

export function validateTransition(
  prev: CallHistoryDetailsFromDiskType | void,
  next: CallHistoryDetailsFromDiskType,
  log: LoggerType
): boolean {
  // Only validating Direct calls for now
  if (next.callMode !== CallMode.Direct) {
    return true;
  }
  if (prev == null) {
    return true;
  }

  strictAssert(
    prev.callMode === CallMode.Direct && next.callMode === CallMode.Direct,
    "Call mode must be 'Direct'"
  );
  strictAssert(prev.callId === next.callId, 'Call ID must not change');
  strictAssert(
    prev.wasIncoming === next.wasIncoming,
    'wasIncoming must not change'
  );
  strictAssert(
    prev.wasVideoCall === next.wasVideoCall,
    'wasVideoCall must not change'
  );

  const before = getCallHistoryStatus(prev);
  const after = getCallHistoryStatus(next);
  log.info(
    `callHistoryDetails: Checking transition (Call ID: ${next.callId}, Before: ${before}, After: ${after})`
  );
  return isAllowedTransition(before, after, log);
}
