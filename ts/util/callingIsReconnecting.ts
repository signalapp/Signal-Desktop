// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  CallMode,
  CallState,
  GroupCallConnectionState,
} from '../types/Calling';
import type { ActiveCallType } from '../types/Calling';
import { isGroupOrAdhocActiveCall } from './isGroupOrAdhocCall';

export function isReconnecting(activeCall: ActiveCallType): boolean {
  return (
    (isGroupOrAdhocActiveCall(activeCall) &&
      activeCall.connectionState === GroupCallConnectionState.Reconnecting) ||
    (activeCall.callMode === CallMode.Direct &&
      activeCall.callState === CallState.Reconnecting)
  );
}
