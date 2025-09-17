// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallState, GroupCallConnectionState } from '../types/Calling.js';
import { CallMode } from '../types/CallDisposition.js';
import type { ActiveCallType } from '../types/Calling.js';
import { isGroupOrAdhocActiveCall } from './isGroupOrAdhocCall.js';

export function isReconnecting(activeCall: ActiveCallType): boolean {
  return (
    (isGroupOrAdhocActiveCall(activeCall) &&
      activeCall.connectionState === GroupCallConnectionState.Reconnecting) ||
    (activeCall.callMode === CallMode.Direct &&
      activeCall.callState === CallState.Reconnecting)
  );
}
