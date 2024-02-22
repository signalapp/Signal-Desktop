// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Note that this file should not important any binary addons or Node.js modules
// because it can be imported by storybook
import {
  CallMode,
  CallState,
  GroupCallConnectionState,
} from '../../types/Calling';
import type { AciString } from '../../types/ServiceId';
import { missingCaseError } from '../../util/missingCaseError';
import type {
  DirectCallStateType,
  CallsByConversationType,
  GroupCallPeekInfoType,
  GroupCallStateType,
} from './calling';

// In theory, there could be multiple incoming calls, or an incoming call while there's
//   an active call. In practice, the UI is not ready for this, and RingRTC doesn't
//   support it for direct calls.
export const getIncomingCall = (
  callsByConversation: Readonly<CallsByConversationType>,
  ourAci: AciString
): undefined | DirectCallStateType | GroupCallStateType =>
  Object.values(callsByConversation).find(call => {
    switch (call.callMode) {
      case CallMode.Direct:
        return call.isIncoming && call.callState === CallState.Ringing;
      case CallMode.Group:
        return (
          call.ringerAci &&
          call.connectionState === GroupCallConnectionState.NotConnected &&
          isAnybodyElseInGroupCall(call.peekInfo, ourAci)
        );
      case CallMode.Adhoc:
        // Adhoc calls cannot be incoming.
        return;
      default:
        throw missingCaseError(call);
    }
  });

export const isAnybodyElseInGroupCall = (
  peekInfo: undefined | Readonly<Pick<GroupCallPeekInfoType, 'acis'>>,
  ourAci: AciString
): boolean => Boolean(peekInfo?.acis.some(id => id !== ourAci));
