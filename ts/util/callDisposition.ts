// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Long from 'long';
import type { Call, PeekInfo, LocalDeviceState } from '@signalapp/ringrtc';
import {
  CallState,
  ConnectionState,
  JoinState,
  callIdFromEra,
  callIdFromRingId,
  RingUpdate,
} from '@signalapp/ringrtc';
import { isEqual } from 'lodash';
import { strictAssert } from './assert';
import { DataReader, DataWriter } from '../sql/Client';
import { SignalService as Proto } from '../protobuf';
import { bytesToUuid, uuidToBytes } from './uuidToBytes';
import { missingCaseError } from './missingCaseError';
import { generateMessageId } from './generateMessageId';
import { CallEndedReason, GroupCallJoinState } from '../types/Calling';
import {
  CallMode,
  DirectCallStatus,
  GroupCallStatus,
  callEventNormalizeSchema,
  CallType,
  CallDirection,
  callEventDetailsSchema,
  LocalCallEvent,
  RemoteCallEvent,
  callHistoryDetailsSchema,
  callDetailsSchema,
  AdhocCallStatus,
  CallStatusValue,
  callLogEventNormalizeSchema,
  CallLogEvent,
  ClearCallHistoryResult,
} from '../types/CallDisposition';
import type { AciString } from '../types/ServiceId';
import { isAciString } from './isAciString';
import { isMe } from './whatTypeOfConversation';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { incrementMessageCounter } from './incrementMessageCounter';
import { ReadStatus } from '../messages/MessageReadStatus';
import { SeenStatus, maxSeenStatus } from '../MessageSeenStatus';
import { canConversationBeUnarchived } from './canConversationBeUnarchived';
import type { ConversationAttributesType } from '../model-types';
import { singleProtoJobQueue } from '../jobs/singleProtoJobQueue';
import MessageSender from '../textsecure/SendMessage';
import * as Bytes from '../Bytes';
import type {
  CallDetails,
  CallEvent,
  CallEventDetails,
  CallHistoryDetails,
  CallHistoryGroup,
  CallLogEventDetails,
  CallStatus,
  GroupCallMeta,
} from '../types/CallDisposition';
import type { ConversationType } from '../state/ducks/conversations';
import type { ConversationModel } from '../models/conversations';
import { drop } from './drop';
import { sendCallLinkUpdateSync } from './sendCallLinkUpdateSync';
import { storageServiceUploadJob } from '../services/storage';
import { CallLinkFinalizeDeleteManager } from '../jobs/CallLinkFinalizeDeleteManager';
import { parsePartial, parseStrict } from './schemas';
import { calling } from '../services/calling';
import { cleanupMessages } from './cleanup';
import { MessageModel } from '../models/messages';

// utils
// -----

// call link roomIds are automatically redacted via redactCallLinkRoomIds()
export function peerIdToLog(peerId: string, mode: CallMode): string {
  return mode === CallMode.Group ? `groupv2(${peerId})` : peerId;
}

export function formatCallEvent(callEvent: CallEventDetails): string {
  const {
    callId,
    peerId,
    direction,
    event,
    eventSource,
    type,
    mode,
    ringerId,
    startedById,
    timestamp,
  } = callEvent;
  const peerIdLog = peerIdToLog(peerId, mode);
  return `CallEvent (${callId}, ${peerIdLog}, ${mode}, ${event}, ${direction}, ${type}, ${mode}, ${timestamp}, ${ringerId}, ${startedById}, ${eventSource})`;
}

export function formatCallHistory(callHistory: CallHistoryDetails): string {
  const {
    callId,
    peerId,
    direction,
    status,
    type,
    mode,
    timestamp,
    ringerId,
    startedById,
  } = callHistory;
  const peerIdLog = peerIdToLog(peerId, mode);
  return `CallHistory (${callId}, ${peerIdLog}, ${mode}, ${status}, ${direction}, ${type}, ${mode}, ${timestamp}, ${ringerId}, ${startedById})`;
}

export function formatCallHistoryGroup(
  callHistoryGroup: CallHistoryGroup
): string {
  const { peerId, direction, status, type, mode, timestamp } = callHistoryGroup;
  return `CallHistoryGroup (${peerId}, ${mode}, ${status}, ${direction}, ${type}, ${mode}, ${timestamp})`;
}

export function formatPeekInfo(peekInfo: PeekInfo): string {
  const { eraId, deviceCount, creator } = peekInfo;
  const callId = eraId != null ? getCallIdFromEra(eraId) : null;
  const creatorAci = creator != null ? getCreatorAci(creator) : null;
  return `PeekInfo (${eraId}, ${callId}, ${creatorAci}, ${deviceCount})`;
}

export function formatLocalDeviceState(
  localDeviceState: LocalDeviceState
): string {
  const connectionState = ConnectionState[localDeviceState.connectionState];
  const joinState = JoinState[localDeviceState.joinState];
  return `LocalDeviceState (${connectionState}, ${joinState})`;
}

export function getCallIdFromRing(ringId: bigint): string {
  return Long.fromValue(callIdFromRingId(ringId)).toString();
}

export function getCallIdFromEra(eraId: string): string {
  return Long.fromValue(callIdFromEra(eraId)).toString();
}

export function getCreatorAci(creator: Buffer): AciString {
  const aci = bytesToUuid(creator);
  strictAssert(aci != null, 'creator uuid buffer was not a valid uuid');
  strictAssert(isAciString(aci), 'creator uuid buffer was not a valid aci');
  return aci;
}

export function getGroupCallMeta(
  peekInfo: PeekInfo | null
): GroupCallMeta | null {
  if (peekInfo?.eraId == null || peekInfo?.creator == null) {
    return null;
  }
  const callId = getCallIdFromEra(peekInfo.eraId);
  const ringerId = bytesToUuid(peekInfo.creator);
  strictAssert(ringerId != null, 'peekInfo.creator was invalid uuid');
  strictAssert(isAciString(ringerId), 'peekInfo.creator was invalid aci');
  return { callId, ringerId };
}

export function getPeerIdFromConversation(
  conversation: ConversationAttributesType | ConversationType
): AciString | string {
  if (conversation.type === 'direct' || conversation.type === 'private') {
    strictAssert(
      isAciString(conversation.serviceId),
      'ACI must exist for direct chat'
    );
    return conversation.serviceId;
  }
  strictAssert(
    conversation.groupId != null,
    'groupId must exist for group chat'
  );
  return conversation.groupId;
}

export function convertJoinState(joinState: JoinState): GroupCallJoinState {
  if (joinState === JoinState.Joined) {
    return GroupCallJoinState.Joined;
  }
  if (joinState === JoinState.Joining) {
    return GroupCallJoinState.Joining;
  }
  if (joinState === JoinState.NotJoined) {
    return GroupCallJoinState.NotJoined;
  }
  if (joinState === JoinState.Pending) {
    return GroupCallJoinState.Pending;
  }
  throw missingCaseError(joinState);
}

// Call Events <-> Protos
// ----------------------

export function getCallEventForProto(
  callEventProto: Proto.SyncMessage.ICallEvent,
  eventSource: string
): CallEventDetails {
  const callEvent = parsePartial(callEventNormalizeSchema, callEventProto);
  const { callId, peerId, timestamp } = callEvent;

  let type: CallType;
  if (callEvent.type === Proto.SyncMessage.CallEvent.Type.GROUP_CALL) {
    type = CallType.Group;
  } else if (callEvent.type === Proto.SyncMessage.CallEvent.Type.AUDIO_CALL) {
    type = CallType.Audio;
  } else if (callEvent.type === Proto.SyncMessage.CallEvent.Type.VIDEO_CALL) {
    type = CallType.Video;
  } else if (callEvent.type === Proto.SyncMessage.CallEvent.Type.AD_HOC_CALL) {
    type = CallType.Adhoc;
  } else {
    throw new TypeError(`Unknown call type ${callEvent.type}`);
  }

  let mode: CallMode;
  if (type === CallType.Group) {
    mode = CallMode.Group;
  } else if (type === CallType.Adhoc) {
    mode = CallMode.Adhoc;
  } else {
    mode = CallMode.Direct;
  }

  let direction: CallDirection;
  if (callEvent.direction === Proto.SyncMessage.CallEvent.Direction.INCOMING) {
    direction = CallDirection.Incoming;
  } else if (
    callEvent.direction === Proto.SyncMessage.CallEvent.Direction.OUTGOING
  ) {
    direction = CallDirection.Outgoing;
  } else {
    throw new TypeError(`Unknown call direction ${callEvent.direction}`);
  }

  let event: RemoteCallEvent;
  if (callEvent.event === Proto.SyncMessage.CallEvent.Event.ACCEPTED) {
    event = RemoteCallEvent.Accepted;
  } else if (
    callEvent.event === Proto.SyncMessage.CallEvent.Event.NOT_ACCEPTED
  ) {
    event = RemoteCallEvent.NotAccepted;
  } else if (callEvent.event === Proto.SyncMessage.CallEvent.Event.DELETE) {
    event = RemoteCallEvent.Delete;
  } else if (callEvent.event === Proto.SyncMessage.CallEvent.Event.OBSERVED) {
    event = RemoteCallEvent.Observed;
  } else {
    throw new TypeError(`Unknown call event ${callEvent.event}`);
  }

  return parseStrict(callEventDetailsSchema, {
    callId,
    peerId,
    ringerId: null,
    startedById: null,
    endedTimestamp: null,
    mode,
    type,
    direction,
    timestamp,
    event,
    eventSource,
  });
}

const callLogEventFromProto: Partial<
  Record<Proto.SyncMessage.CallLogEvent.Type, CallLogEvent>
> = {
  [Proto.SyncMessage.CallLogEvent.Type.CLEAR]: CallLogEvent.Clear,
  [Proto.SyncMessage.CallLogEvent.Type.MARKED_AS_READ]:
    CallLogEvent.MarkedAsRead,
  [Proto.SyncMessage.CallLogEvent.Type.MARKED_AS_READ_IN_CONVERSATION]:
    CallLogEvent.MarkedAsReadInConversation,
};

export function getCallLogEventForProto(
  callLogEventProto: Proto.SyncMessage.ICallLogEvent
): CallLogEventDetails {
  // CallLogEvent peerId is ambiguous whether it's a conversationId (direct, or groupId)
  // or roomId so handle both cases
  const { peerId: peerIdBytes } = callLogEventProto;
  const callLogEvent = parsePartial(callLogEventNormalizeSchema, {
    ...callLogEventProto,
    peerIdAsConversationId: peerIdBytes,
    peerIdAsRoomId: peerIdBytes,
  });

  const type = callLogEventFromProto[callLogEvent.type];
  if (type == null) {
    throw new TypeError(`Unknown call log event ${callLogEvent.type}`);
  }

  return {
    type,
    timestamp: callLogEvent.timestamp,
    peerIdAsConversationId: callLogEvent.peerIdAsConversationId ?? null,
    peerIdAsRoomId: callLogEvent.peerIdAsRoomId ?? null,
    callId: callLogEvent.callId ?? null,
  };
}

const directionToProto = {
  [CallDirection.Incoming]: Proto.SyncMessage.CallEvent.Direction.INCOMING,
  [CallDirection.Outgoing]: Proto.SyncMessage.CallEvent.Direction.OUTGOING,
  [CallDirection.Unknown]:
    Proto.SyncMessage.CallEvent.Direction.UNKNOWN_DIRECTION,
};

const typeToProto = {
  [CallType.Audio]: Proto.SyncMessage.CallEvent.Type.AUDIO_CALL,
  [CallType.Video]: Proto.SyncMessage.CallEvent.Type.VIDEO_CALL,
  [CallType.Group]: Proto.SyncMessage.CallEvent.Type.GROUP_CALL,
  [CallType.Adhoc]: Proto.SyncMessage.CallEvent.Type.AD_HOC_CALL,
  [CallType.Unknown]: Proto.SyncMessage.CallEvent.Type.UNKNOWN_TYPE,
};

const statusToProto: Record<
  CallStatus,
  Proto.SyncMessage.CallEvent.Event | null
> = {
  [CallStatusValue.Accepted]: Proto.SyncMessage.CallEvent.Event.ACCEPTED,
  [CallStatusValue.Declined]: Proto.SyncMessage.CallEvent.Event.NOT_ACCEPTED,
  [CallStatusValue.Deleted]: Proto.SyncMessage.CallEvent.Event.DELETE,
  [CallStatusValue.Missed]: null,
  [CallStatusValue.MissedNotificationProfile]: null,
  [CallStatusValue.Pending]: null,
  [CallStatusValue.GenericGroupCall]: null,
  [CallStatusValue.GenericAdhocCall]:
    Proto.SyncMessage.CallEvent.Event.OBSERVED,
  [CallStatusValue.OutgoingRing]: null,
  [CallStatusValue.Ringing]: null,
  [CallStatusValue.Joined]: null,
  [CallStatusValue.JoinedAdhoc]: Proto.SyncMessage.CallEvent.Event.ACCEPTED,
  [CallStatusValue.Unknown]: Proto.SyncMessage.CallEvent.Event.UNKNOWN_EVENT,
};

function shouldSyncStatus(callStatus: CallStatus) {
  return statusToProto[callStatus] != null;
}

// For outgoing sync messages. peerId contains direct or group conversationId or
// call link peerId. Locally conversationId is Base64 encoded but roomIds
// are hex encoded.
export function getBytesForPeerId(callHistory: CallHistoryDetails): Uint8Array {
  let peerId =
    callHistory.mode === CallMode.Adhoc
      ? Bytes.fromHex(callHistory.peerId)
      : uuidToBytes(callHistory.peerId);
  if (peerId.length === 0) {
    peerId = Bytes.fromBase64(callHistory.peerId);
  }
  return peerId;
}

export function getCallIdForProto(
  callHistory: CallHistoryDetails
): Long | undefined {
  try {
    return Long.fromString(callHistory.callId);
  } catch (error) {
    // When CallHistory is a placeholder record for call links, then the history item's
    // callId is invalid. We will ignore it and only send the timestamp.
    if (callHistory.mode === CallMode.Adhoc) {
      return undefined;
    }

    // For other calls, we expect a valid callId.
    throw error;
  }
}

export function getProtoForCallHistory(
  callHistory: CallHistoryDetails
): Proto.SyncMessage.ICallEvent | null {
  const event = statusToProto[callHistory.status];

  strictAssert(
    event != null,
    `getProtoForCallHistory: Cannot create proto for status ${formatCallHistory(
      callHistory
    )}`
  );

  return new Proto.SyncMessage.CallEvent({
    peerId: getBytesForPeerId(callHistory),
    callId: getCallIdForProto(callHistory),
    type: typeToProto[callHistory.type],
    direction: directionToProto[callHistory.direction],
    event,
    timestamp: Long.fromNumber(callHistory.timestamp),
  });
}

// Local Events
// ------------

const endedReasonToEvent: Record<CallEndedReason, LocalCallEvent> = {
  // Accepted
  [CallEndedReason.AcceptedOnAnotherDevice]: LocalCallEvent.Accepted,
  // Hangup (Incoming = Declined, Outgoing = Missed)
  [CallEndedReason.RemoteHangup]: LocalCallEvent.RemoteHangup,
  [CallEndedReason.LocalHangup]: LocalCallEvent.Hangup,
  // Missed
  [CallEndedReason.Busy]: LocalCallEvent.Missed,
  [CallEndedReason.BusyOnAnotherDevice]: LocalCallEvent.Missed,
  [CallEndedReason.ConnectionFailure]: LocalCallEvent.Missed,
  [CallEndedReason.Glare]: LocalCallEvent.Missed,
  [CallEndedReason.GlareFailure]: LocalCallEvent.Missed,
  [CallEndedReason.InternalFailure]: LocalCallEvent.Missed,
  [CallEndedReason.ReCall]: LocalCallEvent.Missed,
  [CallEndedReason.ReceivedOfferExpired]: LocalCallEvent.Missed,
  [CallEndedReason.ReceivedOfferWhileActive]: LocalCallEvent.Missed,
  [CallEndedReason.ReceivedOfferWithGlare]: LocalCallEvent.Missed,
  [CallEndedReason.RemoteHangupNeedPermission]: LocalCallEvent.Missed,
  [CallEndedReason.SignalingFailure]: LocalCallEvent.Missed,
  [CallEndedReason.Timeout]: LocalCallEvent.Missed,
  [CallEndedReason.Declined]: LocalCallEvent.Missed,
  [CallEndedReason.DeclinedOnAnotherDevice]: LocalCallEvent.Missed,
};

export function getLocalCallEventFromCallEndedReason(
  callEndedReason: CallEndedReason
): LocalCallEvent {
  log.info('getLocalCallEventFromCallEndedReason', callEndedReason);
  return endedReasonToEvent[callEndedReason];
}

export function getLocalCallEventFromDirectCall(
  call: Call
): LocalCallEvent | null {
  log.info('getLocalCallEventFromDirectCall', call.state);
  if (call.state === CallState.Accepted) {
    return LocalCallEvent.Accepted;
  }
  if (call.state === CallState.Ended) {
    strictAssert(call.endedReason != null, 'Call ended without reason');
    return getLocalCallEventFromCallEndedReason(call.endedReason);
  }
  if (call.state === CallState.Ringing) {
    return LocalCallEvent.Ringing;
  }
  if (call.state === CallState.Prering) {
    return null;
  }
  if (call.state === CallState.Reconnecting) {
    return null;
  }
  throw missingCaseError(call.state);
}

const ringUpdateToEvent: Record<RingUpdate, LocalCallEvent> = {
  [RingUpdate.AcceptedOnAnotherDevice]: LocalCallEvent.Accepted,
  [RingUpdate.BusyLocally]: LocalCallEvent.Missed,
  [RingUpdate.BusyOnAnotherDevice]: LocalCallEvent.Missed,
  [RingUpdate.CancelledByRinger]: LocalCallEvent.Missed,
  [RingUpdate.DeclinedOnAnotherDevice]: LocalCallEvent.Missed,
  [RingUpdate.ExpiredRequest]: LocalCallEvent.Missed,
  [RingUpdate.Requested]: LocalCallEvent.Ringing,
};

export function getLocalCallEventFromRingUpdate(
  update: RingUpdate
): LocalCallEvent | null {
  log.info('getLocalCallEventFromRingUpdate', RingUpdate[update]);
  return ringUpdateToEvent[update];
}

export function getLocalCallEventFromJoinState(
  joinState: GroupCallJoinState | null,
  groupCallMeta: GroupCallMeta
): LocalCallEvent | null {
  const direction = getCallDirectionFromRingerId(groupCallMeta.ringerId);
  log.info(
    'getLocalCallEventFromGroupCall',
    direction,
    joinState != null ? GroupCallJoinState[joinState] : null
  );
  if (direction === CallDirection.Incoming) {
    if (joinState === GroupCallJoinState.Joined) {
      return LocalCallEvent.Accepted;
    }
    if (joinState === GroupCallJoinState.NotJoined || joinState == null) {
      return LocalCallEvent.Started;
    }
    if (
      joinState === GroupCallJoinState.Joining ||
      joinState === GroupCallJoinState.Pending
    ) {
      return LocalCallEvent.Accepted;
    }
    throw missingCaseError(joinState);
  } else {
    if (joinState === GroupCallJoinState.NotJoined || joinState == null) {
      return LocalCallEvent.Started;
    }
    return LocalCallEvent.Ringing;
  }
}

// Call Direction
// --------------

function getCallDirectionFromRingerId(
  ringerId: AciString | string
): CallDirection {
  const ringerConversation = window.ConversationController.get(ringerId);
  strictAssert(
    ringerConversation != null,
    `getCallDirectionFromRingerId: Missing ringer conversation (${ringerId})`
  );
  const direction = isMe(ringerConversation.attributes)
    ? CallDirection.Outgoing
    : CallDirection.Incoming;
  return direction;
}

// Call Details
// ------------

export function getCallDetailsFromDirectCall(
  peerId: AciString | string,
  call: Call
): CallDetails {
  const ringerId = call.isIncoming ? call.remoteUserId : null;
  return parseStrict(callDetailsSchema, {
    callId: Long.fromValue(call.callId).toString(),
    peerId,
    ringerId,
    startedById: ringerId,
    mode: CallMode.Direct,
    type: call.isVideoCall ? CallType.Video : CallType.Audio,
    direction: call.isIncoming
      ? CallDirection.Incoming
      : CallDirection.Outgoing,
    timestamp: Date.now(),
    endedTimestamp: null,
  });
}

export function getCallDetailsFromEndedDirectCall(
  callId: string,
  peerId: AciString | string,
  ringerId: AciString | string,
  wasVideoCall: boolean,
  timestamp: number
): CallDetails {
  return parseStrict(callDetailsSchema, {
    callId,
    peerId,
    ringerId,
    startedById: ringerId,
    mode: CallMode.Direct,
    type: wasVideoCall ? CallType.Video : CallType.Audio,
    direction: getCallDirectionFromRingerId(ringerId),
    timestamp,
    endedTimestamp: null,
  });
}

export function getCallDetailsFromGroupCallMeta(
  peerId: AciString | string,
  groupCallMeta: GroupCallMeta
): CallDetails {
  return parseStrict(callDetailsSchema, {
    callId: groupCallMeta.callId,
    peerId,
    ringerId: groupCallMeta.ringerId,
    startedById: groupCallMeta.ringerId,
    mode: CallMode.Group,
    type: CallType.Group,
    direction: getCallDirectionFromRingerId(groupCallMeta.ringerId),
    timestamp: Date.now(),
    endedTimestamp: null,
  });
}

export function getCallDetailsForAdhocCall(
  peerId: AciString | string,
  callId: string
): CallDetails {
  return parseStrict(callDetailsSchema, {
    callId,
    peerId,
    ringerId: null,
    startedById: null,
    mode: CallMode.Adhoc,
    type: CallType.Adhoc,
    // Direction is only outgoing when your action causes ringing for others.
    // As Adhoc calls do not support ringing, this is always incoming for now
    direction: CallDirection.Incoming,
    timestamp: Date.now(),
    endedTimestamp: null,
  });
}

// Call Event Details
// ------------------

export function getCallEventDetails(
  callDetails: CallDetails,
  event: LocalCallEvent,
  eventSource: string
): CallEventDetails {
  return parseStrict(callEventDetailsSchema, {
    ...callDetails,
    event,
    eventSource,
  });
}

// transitions
// -----------

export function transitionCallHistory(
  callHistory: CallHistoryDetails | null,
  callEvent: CallEventDetails
): CallHistoryDetails {
  const {
    callId,
    peerId,
    ringerId,
    startedById,
    mode,
    type,
    direction,
    event,
  } = callEvent;

  if (callHistory != null) {
    strictAssert(callHistory.callId === callId, 'callId must be same');
    strictAssert(callHistory.peerId === peerId, 'peerId must be same');
    strictAssert(
      ringerId == null ||
        callHistory.ringerId == null ||
        callHistory.ringerId === ringerId,
      'ringerId must be same if it exists'
    );
    strictAssert(
      startedById == null ||
        callHistory.startedById == null ||
        callHistory.startedById === startedById,
      'startedById must be same if it exists'
    );
    strictAssert(callHistory.direction === direction, 'direction must be same');
    strictAssert(callHistory.type === type, 'type must be same');
    strictAssert(callHistory.mode === mode, 'mode must be same');
  }

  const prevStatus = callHistory?.status ?? null;
  let status: CallStatus;

  if (mode === CallMode.Direct) {
    status = transitionDirectCallStatus(
      prevStatus as DirectCallStatus | null,
      event,
      direction
    );
  } else if (mode === CallMode.Group) {
    status = transitionGroupCallStatus(
      prevStatus as GroupCallStatus | null,
      event,
      direction
    );
  } else if (mode === CallMode.Adhoc) {
    status = transitionAdhocCallStatus(
      prevStatus as AdhocCallStatus | null,
      event,
      direction
    );
  } else {
    throw missingCaseError(mode);
  }

  const timestamp = transitionTimestamp(callHistory, callEvent);
  log.info(
    `transitionCallHistory: Transitioned call history timestamp (before: ${callHistory?.timestamp}, after: ${timestamp})`
  );

  return parseStrict(callHistoryDetailsSchema, {
    callId,
    peerId,
    ringerId,
    startedById,
    mode,
    type,
    direction,
    timestamp,
    status,
    endedTimestamp: null,
  });
}

function transitionTimestamp(
  callHistory: CallHistoryDetails | null,
  callEvent: CallEventDetails
): number {
  // Sometimes when a device is asleep the timestamp will be stuck in the past.
  // In some cases, we'll accept whatever the most recent timestamp is.
  const latestTimestamp = Math.max(
    callEvent.timestamp,
    callHistory?.timestamp ?? 0
  );

  // Always accept the timestamp if we have no other timestamps.
  if (callHistory == null) {
    return callEvent.timestamp;
  }

  // Deleted call history should never be changed
  if (
    callHistory.status === DirectCallStatus.Deleted ||
    callHistory.status === GroupCallStatus.Deleted ||
    callHistory.status === AdhocCallStatus.Deleted
  ) {
    return callHistory.timestamp;
  }

  // Accepted call history should only be changed if we get a remote accepted
  // event with possibly a better timestamp.
  if (
    callHistory.status === DirectCallStatus.Accepted ||
    callHistory.status === GroupCallStatus.Accepted ||
    callHistory.status === GroupCallStatus.Joined ||
    callHistory.status === AdhocCallStatus.Joined
  ) {
    if (callEvent.event === RemoteCallEvent.Accepted) {
      return latestTimestamp;
    }
    return callHistory.timestamp;
  }

  // Observed call history should only be changed if we get a remote observed
  // event with possibly a better timestamp.
  if (callHistory.status === AdhocCallStatus.Generic) {
    if (callEvent.event === RemoteCallEvent.Observed) {
      return latestTimestamp;
    }
    return callHistory.timestamp;
  }

  // Declined call history should only be changed if if we transition to an
  // accepted state or get a remote 'not accepted' event with possibly a better
  // timestamp.
  if (
    callHistory.status === DirectCallStatus.Declined ||
    callHistory.status === GroupCallStatus.Declined
  ) {
    if (callEvent.event === RemoteCallEvent.NotAccepted) {
      return latestTimestamp;
    }
    return callHistory.timestamp;
  }

  // We don't care about holding onto timestamps that were from these states
  if (
    callHistory.status === DirectCallStatus.Pending ||
    callHistory.status === DirectCallStatus.Unknown ||
    callHistory.status === GroupCallStatus.GenericGroupCall ||
    callHistory.status === GroupCallStatus.OutgoingRing ||
    callHistory.status === GroupCallStatus.Ringing ||
    callHistory.status === DirectCallStatus.Missed ||
    callHistory.status === DirectCallStatus.MissedNotificationProfile ||
    callHistory.status === GroupCallStatus.Missed ||
    callHistory.status === GroupCallStatus.MissedNotificationProfile ||
    callHistory.status === AdhocCallStatus.Pending ||
    callHistory.status === AdhocCallStatus.Unknown
  ) {
    return latestTimestamp;
  }

  throw missingCaseError(callHistory.status);
}

function transitionDirectCallStatus(
  status: DirectCallStatus | null,
  callEvent: CallEvent,
  direction: CallDirection
): DirectCallStatus {
  log.info('transitionDirectCallStatus', status, callEvent, direction);
  // In all cases if we get a delete event, we need to delete the call, and never
  // transition from deleted.
  if (
    callEvent === RemoteCallEvent.Delete ||
    callEvent === LocalCallEvent.Delete ||
    status === DirectCallStatus.Deleted
  ) {
    return DirectCallStatus.Deleted;
  }

  if (
    callEvent === RemoteCallEvent.Accepted ||
    callEvent === LocalCallEvent.Accepted
  ) {
    return DirectCallStatus.Accepted;
  }

  if (status === DirectCallStatus.Accepted) {
    return status;
  }

  if (callEvent === RemoteCallEvent.NotAccepted) {
    if (status === DirectCallStatus.Declined) {
      return DirectCallStatus.Declined;
    }
    return DirectCallStatus.Missed;
  }

  if (callEvent === RemoteCallEvent.Observed) {
    throw new Error(
      `callHistoryDetails: Direct calls shouldn't send ${callEvent}`
    );
  }

  if (callEvent === LocalCallEvent.Missed) {
    return DirectCallStatus.Missed;
  }

  if (callEvent === LocalCallEvent.Declined) {
    return DirectCallStatus.Declined;
  }

  if (callEvent === LocalCallEvent.Hangup) {
    if (direction === CallDirection.Incoming) {
      return DirectCallStatus.Declined;
    }
    return DirectCallStatus.Missed;
  }

  if (callEvent === LocalCallEvent.RemoteHangup) {
    if (direction === CallDirection.Incoming) {
      return DirectCallStatus.Missed;
    }
    return DirectCallStatus.Declined;
  }

  if (
    callEvent === LocalCallEvent.Started ||
    callEvent === LocalCallEvent.Ringing
  ) {
    return DirectCallStatus.Pending;
  }

  throw missingCaseError(callEvent);
}

function transitionGroupCallStatus(
  status: GroupCallStatus | null,
  event: CallEvent,
  direction: CallDirection
): GroupCallStatus {
  log.info('transitionGroupCallStatus', status, event, direction);

  // In all cases if we get a delete event, we need to delete the call, and never
  // transition from deleted.
  if (
    event === RemoteCallEvent.Delete ||
    event === LocalCallEvent.Delete ||
    status === GroupCallStatus.Deleted
  ) {
    return GroupCallStatus.Deleted;
  }

  if (status === GroupCallStatus.Accepted) {
    return status;
  }

  if (
    event === RemoteCallEvent.NotAccepted ||
    event === RemoteCallEvent.Observed
  ) {
    throw new Error(`callHistoryDetails: Group calls shouldn't send ${event}`);
  }

  if (event === RemoteCallEvent.Accepted || event === LocalCallEvent.Accepted) {
    switch (status) {
      case null: {
        return GroupCallStatus.Joined;
      }
      case GroupCallStatus.Ringing:
      case GroupCallStatus.Missed:
      case GroupCallStatus.MissedNotificationProfile:
      case GroupCallStatus.Declined: {
        return GroupCallStatus.Accepted;
      }
      case GroupCallStatus.GenericGroupCall: {
        return GroupCallStatus.Joined;
      }
      case GroupCallStatus.Joined:
      case GroupCallStatus.OutgoingRing: {
        return status;
      }
      default: {
        throw missingCaseError(status);
      }
    }
  }

  if (event === LocalCallEvent.Started) {
    return GroupCallStatus.GenericGroupCall;
  }

  if (event === LocalCallEvent.Ringing) {
    return GroupCallStatus.Ringing;
  }

  if (event === LocalCallEvent.Missed) {
    return GroupCallStatus.Missed;
  }

  if (event === LocalCallEvent.Declined) {
    return GroupCallStatus.Declined;
  }

  if (event === LocalCallEvent.Hangup) {
    if (direction === CallDirection.Incoming) {
      return GroupCallStatus.Declined;
    }
    return GroupCallStatus.Missed;
  }

  if (event === LocalCallEvent.RemoteHangup) {
    if (direction === CallDirection.Incoming) {
      return GroupCallStatus.Missed;
    }
    return GroupCallStatus.Declined;
  }

  throw missingCaseError(event);
}

function transitionAdhocCallStatus(
  status: AdhocCallStatus | null,
  callEvent: CallEvent,
  direction: CallDirection
): AdhocCallStatus {
  log.info(
    `transitionAdhocCallStatus: status=${status} callEvent=${callEvent} direction=${direction}`
  );

  // In all cases if we get a delete event, we need to delete the call, and never
  // transition from deleted.
  if (
    callEvent === RemoteCallEvent.Delete ||
    callEvent === LocalCallEvent.Delete ||
    status === AdhocCallStatus.Deleted
  ) {
    return AdhocCallStatus.Deleted;
  }

  // The Accepted event is used to indicate we have fully joined an adhoc call.
  // If admin approval was required for a call link, this event indicates approval
  // was granted.
  if (
    callEvent === RemoteCallEvent.Accepted ||
    callEvent === LocalCallEvent.Accepted
  ) {
    return AdhocCallStatus.Joined;
  }

  if (status === AdhocCallStatus.Joined) {
    return status;
  }

  if (
    callEvent === RemoteCallEvent.Observed ||
    callEvent === LocalCallEvent.Started
  ) {
    return AdhocCallStatus.Generic;
  }

  // For Adhoc calls, ringing and corresponding events are not supported currently.
  // However we handle those events here to be exhaustive.
  if (
    callEvent === RemoteCallEvent.NotAccepted ||
    callEvent === LocalCallEvent.Missed ||
    callEvent === LocalCallEvent.Declined ||
    callEvent === LocalCallEvent.Hangup ||
    callEvent === LocalCallEvent.RemoteHangup ||
    // never actually happens, but need for exhaustive check
    callEvent === LocalCallEvent.Ringing
  ) {
    return AdhocCallStatus.Pending;
  }

  throw missingCaseError(callEvent);
}

// actions
// -------

async function updateLocalCallHistory(
  callEvent: CallEventDetails,
  receivedAtCounter: number | null,
  receivedAtMS: number | null
): Promise<CallHistoryDetails | null> {
  const conversation = window.ConversationController.get(callEvent.peerId);
  strictAssert(
    conversation != null,
    `updateLocalCallHistory: Conversation not found ${formatCallEvent(
      callEvent
    )}`
  );
  return conversation.queueJob<CallHistoryDetails | null>(
    'updateLocalCallHistory',
    async () => {
      log.info(
        'updateLocalCallHistory: Processing call event:',
        formatCallEvent(callEvent)
      );

      const prevCallHistory =
        (await DataReader.getCallHistory(callEvent.callId, callEvent.peerId)) ??
        null;

      if (prevCallHistory != null) {
        log.info(
          'updateLocalCallHistory: Found previous call history:',
          formatCallHistory(prevCallHistory)
        );
      } else {
        log.info('updateLocalCallHistory: No previous call history');
      }

      let callHistory: CallHistoryDetails;
      try {
        callHistory = transitionCallHistory(prevCallHistory, callEvent);
      } catch (error) {
        log.error(
          "updateLocalCallHistory: Couldn't transition call history:",
          formatCallEvent(callEvent),
          Errors.toLogFormat(error)
        );
        return null;
      }

      const updatedCallHistory = await saveCallHistory({
        callHistory,
        conversation,
        receivedAtCounter,
        receivedAtMS,
      });
      return updatedCallHistory;
    }
  );
}

export async function updateAdhocCallHistory(
  callEvent: CallEventDetails
): Promise<void> {
  const callHistory = await updateLocalAdhocCallHistory(callEvent);
  if (!callHistory) {
    return;
  }

  drop(updateRemoteCallHistory(callHistory));
}

export async function updateLocalAdhocCallHistory(
  callEvent: CallEventDetails
): Promise<CallHistoryDetails | null> {
  log.info(
    'updateLocalAdhocCallHistory: Processing call event:',
    formatCallEvent(callEvent)
  );

  const prevCallHistory =
    (await DataReader.getCallHistory(callEvent.callId, callEvent.peerId)) ??
    null;

  if (prevCallHistory != null) {
    log.info(
      'updateAdhocCallHistory: Found previous call history:',
      formatCallHistory(prevCallHistory)
    );
  } else {
    log.info('updateAdhocCallHistory: No previous call history');
  }

  let callHistory: CallHistoryDetails;
  try {
    callHistory = transitionCallHistory(prevCallHistory, callEvent);
  } catch (error) {
    log.error(
      "updateAdhocCallHistory: Couldn't transition call history:",
      formatCallEvent(callEvent),
      Errors.toLogFormat(error)
    );
    return null;
  }

  strictAssert(
    callHistory.status === AdhocCallStatus.Generic ||
      callHistory.status === AdhocCallStatus.Pending ||
      callHistory.status === AdhocCallStatus.Joined ||
      callHistory.status === AdhocCallStatus.Deleted,
    `updateAdhocCallHistory: callHistory must have adhoc status (was ${callHistory.status})`
  );

  const isDeleted = callHistory.status === AdhocCallStatus.Deleted;
  if (prevCallHistory != null && isEqual(prevCallHistory, callHistory)) {
    log.info(
      'updateAdhocCallHistory: Next call history is identical, skipping save'
    );
  } else {
    log.info(
      'updateAdhocCallHistory: Saving call history:',
      formatCallHistory(callHistory)
    );
    await DataWriter.saveCallHistory(callHistory);

    /*
      If we're not a call link admin and this is the first call history for this link,
      then it means we clicked someone else's link and discovered it was active. We
      sync this newly observed call link so the subsequent call event OBSERVED sync
      message refers to a valid call link.
    */
    if (prevCallHistory == null) {
      const callLink = await DataReader.getCallLinkByRoomId(callEvent.peerId);
      if (callLink) {
        log.info(
          `updateAdhocCallHistory: Syncing new observed call link ${callEvent.peerId}`
        );
        drop(sendCallLinkUpdateSync(callLink));
      } else {
        log.error(
          `updateAdhocCallHistory: New observed call link missing in DB: ${callEvent.peerId}`
        );
      }
    }
  }

  if (isDeleted) {
    window.reduxActions.callHistory.removeCallHistory(callHistory.callId);
  } else {
    window.reduxActions.callHistory.addCallHistory(callHistory);
  }

  return callHistory;
}

async function saveCallHistory({
  callHistory,
  conversation,
  receivedAtCounter,
  receivedAtMS,
}: {
  callHistory: CallHistoryDetails;
  conversation: ConversationModel;
  receivedAtCounter: number | null;
  receivedAtMS: number | null;
}): Promise<CallHistoryDetails> {
  log.info(
    'saveCallHistory: Saving call history:',
    formatCallHistory(callHistory)
  );

  const isDeleted =
    callHistory.status === DirectCallStatus.Deleted ||
    callHistory.status === GroupCallStatus.Deleted;

  await DataWriter.saveCallHistory(callHistory);

  if (isDeleted) {
    window.reduxActions.callHistory.removeCallHistory(callHistory.callId);
  } else {
    window.reduxActions.callHistory.addCallHistory(callHistory);
  }

  const prevMessage = await DataReader.getCallHistoryMessageByCallId({
    conversationId: conversation.id,
    callId: callHistory.callId,
  });

  if (prevMessage != null) {
    log.info(
      'saveCallHistory: Found previous call history message:',
      prevMessage.id
    );
  } else {
    log.info(
      'saveCallHistory: No previous call history message',
      conversation.id
    );
  }

  if (isDeleted) {
    if (prevMessage != null) {
      await DataWriter.removeMessage(prevMessage.id, {
        fromSync: true,
        cleanupMessages,
      });
    }
    return callHistory;
  }

  let unseen = false;
  if (callHistory.mode === CallMode.Direct) {
    unseen =
      callHistory.direction === CallDirection.Incoming &&
      (callHistory.status === DirectCallStatus.Missed ||
        callHistory.status === DirectCallStatus.Pending);
  } else if (callHistory.mode === CallMode.Group) {
    unseen =
      callHistory.direction === CallDirection.Incoming &&
      (callHistory.status === GroupCallStatus.Ringing ||
        callHistory.status === GroupCallStatus.GenericGroupCall ||
        callHistory.status === GroupCallStatus.Missed);
  }

  let seenStatus = unseen ? SeenStatus.Unseen : SeenStatus.NotApplicable;
  if (prevMessage?.seenStatus != null) {
    seenStatus = maxSeenStatus(seenStatus, prevMessage.seenStatus);
  }

  const counter =
    prevMessage?.received_at ?? receivedAtCounter ?? incrementMessageCounter();

  const { id: newId } = generateMessageId(counter);

  const message = new MessageModel({
    id: prevMessage?.id ?? newId,
    conversationId: conversation.id,
    type: 'call-history',
    timestamp: prevMessage?.timestamp ?? callHistory.timestamp,
    sent_at: prevMessage?.sent_at ?? callHistory.timestamp,
    received_at: counter,
    received_at_ms:
      prevMessage?.received_at_ms ?? receivedAtMS ?? callHistory.timestamp,
    readStatus: ReadStatus.Read,
    seenStatus,
    callId: callHistory.callId,
  });

  const id = await window.MessageCache.saveMessage(message, {
    forceSave: prevMessage == null,
  });
  message.set({ id });
  log.info('saveCallHistory: Saved call history message:', message.id);

  const model = window.MessageCache.register(message);

  if (prevMessage == null) {
    if (callHistory.direction === CallDirection.Outgoing) {
      conversation.incrementSentMessageCount();
    } else {
      conversation.incrementMessageCount();
    }
    drop(conversation.onNewMessage(model));
  }

  await conversation.updateLastMessage().catch(error => {
    log.error(
      'saveCallHistory: Failed to update last message:',
      Errors.toLogFormat(error)
    );
  });

  conversation.set(
    'active_at',
    Math.max(conversation.get('active_at') ?? 0, callHistory.timestamp)
  );

  if (canConversationBeUnarchived(conversation.attributes)) {
    conversation.setArchived(false);
  } else {
    await DataWriter.updateConversation(conversation.attributes);
  }

  window.reduxActions.callHistory.updateCallHistoryUnreadCount();

  return callHistory;
}

async function updateRemoteCallHistory(
  callHistory: CallHistoryDetails
): Promise<void> {
  if (!shouldSyncStatus(callHistory.status)) {
    log.info(
      'updateRemoteCallHistory: Not syncing call history:',
      formatCallHistory(callHistory)
    );
    return;
  }

  log.info(
    'updateRemoteCallHistory: syncing call history:',
    formatCallHistory(callHistory)
  );

  try {
    const ourAci = window.textsecure.storage.user.getCheckedAci();
    const syncMessage = MessageSender.createSyncMessage();

    syncMessage.callEvent = getProtoForCallHistory(callHistory);

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    await singleProtoJobQueue.add({
      contentHint: ContentHint.RESENDABLE,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'callEventSync',
      urgent: false,
    });
  } catch (error) {
    log.error(
      'updateRemoteCallHistory: Failed to queue sync message:',
      Errors.toLogFormat(error)
    );
  }
}

export async function updateCallHistoryFromRemoteEvent(
  callEvent: CallEventDetails,
  receivedAtCounter: number,
  receivedAtMS: number
): Promise<void> {
  if (callEvent.mode === CallMode.Direct || callEvent.mode === CallMode.Group) {
    await updateLocalCallHistory(callEvent, receivedAtCounter, receivedAtMS);
  } else if (callEvent.mode === CallMode.Adhoc) {
    await updateLocalAdhocCallHistory(callEvent);
  }
}

export async function updateCallHistoryFromLocalEvent(
  callEvent: CallEventDetails,
  receivedAtCounter: number | null,
  receivedAtMS: number | null
): Promise<void> {
  const updatedCallHistory = await updateLocalCallHistory(
    callEvent,
    receivedAtCounter,
    receivedAtMS
  );
  if (updatedCallHistory == null) {
    return;
  }
  await updateRemoteCallHistory(updatedCallHistory);
}

export function updateDeletedMessages(messageIds: ReadonlyArray<string>): void {
  messageIds.forEach(messageId => {
    const message = window.MessageCache.getById(messageId);
    const conversation = window.ConversationController.get(
      message?.get('conversationId')
    );
    if (message == null || conversation == null) {
      return;
    }
    window.reduxActions.conversations.messageDeleted(
      messageId,
      message.get('conversationId')
    );
    conversation.debouncedUpdateLastMessage();
    window.MessageCache.unregister(messageId);
  });
}

export async function clearCallHistoryDataAndSync(
  latestCall: CallHistoryDetails
): Promise<ClearCallHistoryResult> {
  try {
    log.info(
      `clearCallHistory: Clearing call history before (${latestCall.callId}, ${latestCall.timestamp})`
    );
    // This skips call history for admin call links.
    const messageIds = await DataWriter.clearCallHistory(latestCall);
    const isStorageSyncNeeded = await DataWriter.beginDeleteAllCallLinks();
    if (isStorageSyncNeeded) {
      storageServiceUploadJob({ reason: 'clearCallHistoryDataAndSync' });
    }
    updateDeletedMessages(messageIds);
    log.info('clearCallHistory: Queueing sync message');
    await singleProtoJobQueue.add(
      MessageSender.getClearCallHistoryMessage(latestCall)
    );

    const adminCallLinks = await DataReader.getAllAdminCallLinks();
    const callLinkCount = adminCallLinks.length;
    if (callLinkCount > 0) {
      log.info(`clearCallHistory: Deleting ${callLinkCount} admin call links`);
      let successCount = 0;
      let failCount = 0;
      for (const callLink of adminCallLinks) {
        try {
          // This throws if call link is active or network is unavailable.
          // eslint-disable-next-line no-await-in-loop
          await calling.deleteCallLink(callLink);
          // eslint-disable-next-line no-await-in-loop
          await DataWriter.deleteCallHistoryByRoomId(callLink.roomId);
          // Wait for storage service sync before finalizing delete.
          drop(
            CallLinkFinalizeDeleteManager.addJob(
              { roomId: callLink.roomId },
              { delay: 10000 }
            )
          );
          successCount += 1;
        } catch (error) {
          log.warn('clearCallHistory: Failed to delete admin call link', error);
          failCount += 1;
        }
      }
      log.info(
        `clearCallHistory: Deleted admin call links, success=${successCount} failed=${failCount}`
      );

      if (failCount > 0) {
        return ClearCallHistoryResult.ErrorDeletingCallLinks;
      }
    }
  } catch (error) {
    log.error('clearCallHistory: Failed to clear call history', error);
    return ClearCallHistoryResult.Error;
  }

  return ClearCallHistoryResult.Success;
}

export async function markAllCallHistoryReadAndSync(
  latestCall: CallHistoryDetails,
  inConversation: boolean
): Promise<void> {
  try {
    log.info(
      `markAllCallHistoryReadAndSync: Marking call history read before (${latestCall.callId}, ${latestCall.timestamp})`
    );
    let count: number;
    if (inConversation) {
      count = await DataWriter.markAllCallHistoryReadInConversation(latestCall);
    } else {
      count = await DataWriter.markAllCallHistoryRead(latestCall);
    }

    log.info(
      `markAllCallHistoryReadAndSync: Marked ${count} call history messages read`
    );

    const ourAci = window.textsecure.storage.user.getCheckedAci();

    const callLogEvent = new Proto.SyncMessage.CallLogEvent({
      type: inConversation
        ? Proto.SyncMessage.CallLogEvent.Type.MARKED_AS_READ_IN_CONVERSATION
        : Proto.SyncMessage.CallLogEvent.Type.MARKED_AS_READ,
      timestamp: Long.fromNumber(latestCall.timestamp),
      peerId: getBytesForPeerId(latestCall),
      callId: Long.fromString(latestCall.callId),
    });

    const syncMessage = MessageSender.createSyncMessage();
    syncMessage.callLogEvent = callLogEvent;

    const contentMessage = new Proto.Content();
    contentMessage.syncMessage = syncMessage;

    const { ContentHint } = Proto.UnidentifiedSenderMessage.Message;

    log.info('markAllCallHistoryReadAndSync: Queueing sync message');
    await singleProtoJobQueue.add({
      contentHint: ContentHint.RESENDABLE,
      serviceId: ourAci,
      isSyncMessage: true,
      protoBase64: Bytes.toBase64(
        Proto.Content.encode(contentMessage).finish()
      ),
      type: 'callLogEventSync',
      urgent: false,
    });
  } catch (error) {
    log.error(
      'markAllCallHistoryReadAndSync: Failed to mark call history read',
      error
    );
  }
}

export async function updateLocalGroupCallHistoryTimestamp(
  conversationId: string,
  callId: string,
  timestamp: number
): Promise<CallHistoryDetails | null> {
  const conversation = window.ConversationController.get(conversationId);
  if (conversation == null) {
    return null;
  }

  return conversation.queueJob<CallHistoryDetails | null>(
    'updateLocalGroupCallHistoryTimestamp',
    async () => {
      const peerId = getPeerIdFromConversation(conversation.attributes);

      const prevCallHistory =
        (await DataReader.getCallHistory(callId, peerId)) ?? null;

      // We don't have all the details to add new call history here
      if (prevCallHistory != null) {
        log.info(
          'updateLocalGroupCallHistoryTimestamp: Found previous call history:',
          formatCallHistory(prevCallHistory)
        );
      } else {
        log.info(
          'updateLocalGroupCallHistoryTimestamp: No previous call history'
        );
        return null;
      }

      if (timestamp >= prevCallHistory.timestamp) {
        log.info(
          'updateLocalGroupCallHistoryTimestamp: New timestamp is later than existing call history, ignoring'
        );
        return prevCallHistory;
      }

      const updatedCallHistory = await saveCallHistory({
        callHistory: {
          ...prevCallHistory,
          timestamp,
        },
        conversation,
        receivedAtCounter: null,
        receivedAtMS: null,
      });

      return updatedCallHistory;
    }
  );
}
