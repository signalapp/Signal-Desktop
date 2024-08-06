// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallHistoryGroup } from '../../types/CallDisposition';
import {
  AdhocCallStatus,
  CallDirection,
  CallType,
  DirectCallStatus,
  CallMode,
} from '../../types/CallDisposition';
import { DurationInSeconds } from '../../util/durations';

function mins(n: number) {
  return DurationInSeconds.toMillis(DurationInSeconds.fromMinutes(n));
}

export function getFakeCallHistoryGroup(
  overrides: Partial<CallHistoryGroup> = {}
): CallHistoryGroup {
  return {
    peerId: '',
    mode: CallMode.Direct,
    type: CallType.Video,
    direction: CallDirection.Incoming,
    status: DirectCallStatus.Accepted,
    timestamp: Date.now(),
    children: [
      { callId: '123', timestamp: Date.now() },
      { callId: '122', timestamp: Date.now() - mins(30) },
      { callId: '121', timestamp: Date.now() - mins(45) },
      { callId: '121', timestamp: Date.now() - mins(60) },
    ],
    ...overrides,
  };
}

export function getFakeCallLinkHistoryGroup(
  overrides: Partial<CallHistoryGroup> = {}
): CallHistoryGroup {
  return getFakeCallHistoryGroup({
    mode: CallMode.Adhoc,
    type: CallType.Adhoc,
    status: AdhocCallStatus.Joined,
    ...overrides,
  });
}
