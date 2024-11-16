// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Note that this file should not important any binary addons or Node.js modules
// because it can be imported by storybook
import {
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../../types/Calling';
import { CallMode } from '../../types/CallDisposition';

import type { CallingConversationType } from '../../types/Calling';
import type { AciString } from '../../types/ServiceId';
import type {
  DirectCallStateType,
  CallsByConversationType,
  GroupCallPeekInfoType,
  GroupCallStateType,
  GroupCallParticipantInfoType,
  ActiveCallStateType,
} from './calling';

export const MAX_CALL_PARTICIPANTS_FOR_DEFAULT_MUTE = 8;

// In theory, there could be multiple incoming calls, or an incoming call while there's
//   an active call. In practice, the UI is not ready for this, and RingRTC doesn't
//   support it for direct calls.
// Adhoc calls can not be incoming, so we don't look for them here.
export const getRingingCall = (
  callsByConversation: Readonly<CallsByConversationType>,
  activeCallState: ActiveCallStateType | undefined,
  ourAci: AciString
): DirectCallStateType | GroupCallStateType | undefined => {
  const callList = Object.values(callsByConversation);
  const ringingDirect = callList.find(call => {
    if (call.callMode !== CallMode.Direct) {
      return false;
    }

    if (
      activeCallState?.state === 'Active' &&
      activeCallState.conversationId !== call.conversationId
    ) {
      return false;
    }

    if (
      activeCallState?.state === 'Active' &&
      activeCallState?.outgoingRing &&
      call.callState === CallState.Prering
    ) {
      return true;
    }

    return call.callState === CallState.Ringing && call.callEndedReason == null;
  });

  if (ringingDirect) {
    return ringingDirect;
  }

  return callList.find(call => {
    if (call.callMode !== CallMode.Group) {
      return false;
    }

    if (
      activeCallState?.state === 'Active' &&
      activeCallState.conversationId !== call.conversationId
    ) {
      return false;
    }

    // Outgoing - ringerAci is not set for outgoing group calls
    if (
      activeCallState?.state === 'Active' &&
      activeCallState.conversationId === call.conversationId &&
      activeCallState.outgoingRing &&
      isConnected(call.connectionState) &&
      isJoined(call.joinState) &&
      !hasRemoteParticipants(call.remoteParticipants)
    ) {
      return true;
    }

    // Incoming
    return (
      call.ringerAci &&
      call.ringerAci !== ourAci &&
      !isConnected(call.connectionState) &&
      !isJoined(call.joinState) &&
      isAnybodyElseInGroupCall(call.peekInfo, ourAci)
    );
  });
};

export const isAnybodyElseInGroupCall = (
  peekInfo: undefined | Readonly<Pick<GroupCallPeekInfoType, 'acis'>>,
  ourAci: AciString
): boolean => Boolean(peekInfo?.acis.some(id => id !== ourAci));

export const isAnybodyInGroupCall = (
  peekInfo: undefined | Readonly<Pick<GroupCallPeekInfoType, 'acis'>>
): boolean => {
  if (!peekInfo?.acis) {
    return false;
  }
  return peekInfo.acis.length > 0;
};

export const isGroupCallActiveOnServer = (
  peekInfo: undefined | Readonly<Pick<GroupCallPeekInfoType, 'eraId'>>
): boolean => {
  return Boolean(peekInfo?.eraId);
};

export function isLonelyGroup(conversation: CallingConversationType): boolean {
  return (conversation.sortedGroupMembers?.length ?? 0) < 2;
}

function isConnected(connectionState: GroupCallConnectionState): boolean {
  return (
    connectionState === GroupCallConnectionState.Connecting ||
    connectionState === GroupCallConnectionState.Connected
  );
}

function isJoined(joinState: GroupCallJoinState): boolean {
  return joinState !== GroupCallJoinState.NotJoined;
}

function hasRemoteParticipants(
  remoteParticipants: Array<GroupCallParticipantInfoType>
): boolean {
  return remoteParticipants.length > 0;
}
