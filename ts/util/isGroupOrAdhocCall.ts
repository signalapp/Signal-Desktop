// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { CallMode } from '../types/CallDisposition';
import type { ActiveCallType, ActiveGroupCallType } from '../types/Calling';
import type {
  DirectCallStateType,
  GroupCallStateType,
} from '../state/ducks/calling';

export function isGroupOrAdhocActiveCall(
  activeCall: ActiveCallType | undefined
): activeCall is ActiveGroupCallType {
  return Boolean(activeCall && isGroupOrAdhocCallMode(activeCall.callMode));
}

export function isGroupOrAdhocCallMode(
  callMode: CallMode | undefined | null
): callMode is CallMode.Group | CallMode.Adhoc {
  return callMode === CallMode.Group || callMode === CallMode.Adhoc;
}

export function isGroupOrAdhocCallState(
  callState: DirectCallStateType | GroupCallStateType | undefined
): callState is GroupCallStateType {
  return Boolean(
    callState &&
      (callState.callMode === CallMode.Group ||
        callState.callMode === CallMode.Adhoc)
  );
}
