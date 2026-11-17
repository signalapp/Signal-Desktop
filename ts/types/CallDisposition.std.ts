// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import type { AciString } from './ServiceId.std.ts';
import { aciSchema } from './ServiceId.std.ts';
import { bytesToUuid } from '../util/uuidToBytes.std.ts';
import { toBase64, toHex } from '../Bytes.std.ts';
import { SignalService as Proto } from '../protobuf/index.std.ts';
import { UUID_BYTE_SIZE } from './Crypto.std.ts';

import { toNumber } from '../util/toNumber.std.ts';
import { strictAssert } from '../util/assert.std.ts';

// These are strings (1) for the backup (2) for Storybook.
export enum CallMode {
  Direct = 'Direct',
  Group = 'Group',
  Adhoc = 'Adhoc',
}

export enum CallType {
  Audio = 'Audio',
  Video = 'Video',
  Group = 'Group',
  Adhoc = 'Adhoc',
  // Only used for backup roundtripping
  Unknown = 'Unknown',
}

export enum CallDirection {
  Incoming = 'Incoming',
  Outgoing = 'Outgoing',
  // Only used for backup roundtripping
  Unknown = 'Unknown',
}

export enum CallLogEvent {
  Clear = 'Clear',
  UNIMPLEMENTED_ClearInConversation = 'ClearInConversation',
  MarkedAsRead = 'MarkedAsRead',
  MarkedAsReadInConversation = 'MarkedAsReadInConversation',
}

export enum LocalCallEvent {
  Started = 'LocalStarted',
  Ringing = 'LocalRinging',
  Accepted = 'LocalAccepted',
  Declined = 'LocalDeclined',
  Hangup = 'LocalHangup', // Incoming = Declined, Outgoing = Missed
  RemoteHangup = 'LocalRemoteHangup', // Incoming = Missed, Outgoing = Declined
  Missed = 'LocalMissed',
  Delete = 'LocalDelete',
}

export enum RemoteCallEvent {
  Accepted = 'Accepted',
  NotAccepted = 'NotAccepted',
  Delete = 'Delete',
  Observed = 'Observed',
}

export type CallEvent = LocalCallEvent | RemoteCallEvent;

export enum CallStatusValue {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Missed = 'Missed',
  // TODO: DESKTOP-3483 - not generated locally
  MissedNotificationProfile = 'MissedNotificationProfile',
  Declined = 'Declined',
  Deleted = 'Deleted',
  GenericGroupCall = 'GenericGroupCall',
  GenericAdhocCall = 'GenericAdhocCall',
  OutgoingRing = 'OutgoingRing',
  Ringing = 'Ringing',
  Joined = 'Joined',
  JoinedAdhoc = 'JoinedAdhoc',
  // Only used for backup roundtripping
  Unknown = 'Unknown',
}

export enum DirectCallStatus {
  Pending = CallStatusValue.Pending,
  Accepted = CallStatusValue.Accepted,
  Missed = CallStatusValue.Missed,
  // TODO: DESKTOP-3483 - not generated locally
  MissedNotificationProfile = CallStatusValue.MissedNotificationProfile,
  Declined = CallStatusValue.Declined,
  Deleted = CallStatusValue.Deleted,
  // Only used for backup roundtripping
  Unknown = CallStatusValue.Unknown,
}

export enum GroupCallStatus {
  GenericGroupCall = CallStatusValue.GenericGroupCall,
  OutgoingRing = CallStatusValue.OutgoingRing,
  Ringing = CallStatusValue.Ringing,
  Joined = CallStatusValue.Joined,
  Accepted = CallStatusValue.Accepted,
  Missed = CallStatusValue.Missed,
  // TODO: DESKTOP-3483 - not generated locally
  MissedNotificationProfile = CallStatusValue.MissedNotificationProfile,
  Declined = CallStatusValue.Declined,
  Deleted = CallStatusValue.Deleted,
}

export enum AdhocCallStatus {
  Generic = CallStatusValue.GenericAdhocCall,
  Pending = CallStatusValue.Pending,
  Joined = CallStatusValue.JoinedAdhoc,
  Deleted = CallStatusValue.Deleted,
  // Only used for backup roundtripping
  Unknown = CallStatusValue.Unknown,
}

export type CallStatus = DirectCallStatus | GroupCallStatus | AdhocCallStatus;

export type CallDetails = Readonly<{
  callId: string;
  peerId: AciString | string;
  ringerId: AciString | string | null;
  startedById: AciString | string | null;
  mode: CallMode;
  type: CallType;
  direction: CallDirection;
  timestamp: number;
  endedTimestamp: number | null;
}>;

export type CallLogEventTarget = Readonly<
  {
    timestamp: number;
    callId: string | null;
  } & (
    | {
        peerId: AciString | string | null;
      }
    | {
        peerIdAsConversationId: AciString | string | null;
        peerIdAsRoomId: string | null;
      }
  )
>;

export type CallLogEventDetails = Readonly<{
  type: CallLogEvent;
  targetTimestamp: number;
  peerIdAsConversationId: AciString | string | null;
  peerIdAsRoomId: string | null;
  callId: string | null;
  eventTimestamp: number;
}>;

export type CallEventDetails = CallDetails &
  Readonly<{
    event: CallEvent;
    eventSource: string;
    eventTimestamp: number;
  }>;

export type CallHistoryDetails = CallDetails &
  Readonly<{
    status: CallStatus;
  }>;

export type CallHistoryGroup = Omit<
  CallHistoryDetails,
  'callId' | 'ringerId' | 'startedById' | 'endedTimestamp'
> &
  Readonly<{
    children: ReadonlyArray<{
      callId: string;
      timestamp: number;
    }>;
  }>;

export type GroupCallMeta = Readonly<{
  callId: string;
  ringerId: string | AciString;
}>;

export enum CallHistoryFilterStatus {
  All = 'All',
  Missed = 'Missed',
}

export type CallHistoryFilterOptions = Readonly<{
  status: CallHistoryFilterStatus;
  query: string;
}>;

export type CallHistoryFilter = Readonly<{
  status: CallHistoryFilterStatus;
  callLinkRoomIds: ReadonlyArray<string> | null;
  conversationIds: ReadonlyArray<string> | null;
}>;

export type CallHistoryPagination = Readonly<{
  offset: number;
  limit: number;
}>;

export enum ClearCallHistoryResult {
  Success = 'Success',
  Error = 'Error',
  ErrorDeletingCallLinks = 'ErrorDeletingCallLinks',
}

const ringerIdSchema = z.union([aciSchema, z.string(), z.null()]);

const callModeSchema = z.nativeEnum(CallMode);
const callTypeSchema = z.nativeEnum(CallType);
const callDirectionSchema = z.nativeEnum(CallDirection);
const callEventSchema = z.union([
  z.nativeEnum(LocalCallEvent),
  z.nativeEnum(RemoteCallEvent),
]);
const callStatusSchema = z.union([
  z.nativeEnum(DirectCallStatus),
  z.nativeEnum(GroupCallStatus),
  z.nativeEnum(AdhocCallStatus),
]);

export const callDetailsSchema = z.object({
  callId: z.string(),
  peerId: z.string(),
  ringerId: ringerIdSchema,
  startedById: aciSchema.or(z.null()),
  mode: callModeSchema,
  type: callTypeSchema,
  direction: callDirectionSchema,
  timestamp: z.number(),
  endedTimestamp: z.number().or(z.null()),
}) satisfies z.ZodType<CallDetails>;

export const callEventDetailsSchema = callDetailsSchema.extend({
  event: callEventSchema,
  eventSource: z.string(),
  eventTimestamp: z.number(),
}) satisfies z.ZodType<CallEventDetails>;

export const callHistoryDetailsSchema = callDetailsSchema.extend({
  status: callStatusSchema,
}) satisfies z.ZodType<CallHistoryDetails>;

export const callHistoryGroupChildSchema = z.object({
  callId: z.string(),
  timestamp: z.number(),
});

export const callHistoryGroupSchema = z.object({
  peerId: z.string(),
  mode: callModeSchema,
  type: callTypeSchema,
  direction: callDirectionSchema,
  status: callStatusSchema,
  timestamp: z.number(),
  children: z.array(callHistoryGroupChildSchema),
}) satisfies z.ZodType<CallHistoryGroup>;

const conversationPeerIdInBytesSchema = z
  .instanceof(Uint8Array)
  .transform((value): string | AciString => {
    // direct conversationId
    if (value.byteLength === UUID_BYTE_SIZE) {
      const uuid = bytesToUuid(value);
      if (uuid != null) {
        return uuid;
      }
    }

    // groupId
    return toBase64(value);
  });

const roomIdInBytesSchema = z
  .instanceof(Uint8Array)
  .transform(value => toHex(value));

const longToStringSchema = z.bigint().transform(big => big.toString());

const longToNumberSchema = z.bigint().transform(big => toNumber(big));

export const callEventNormalizeSchema = z
  .object({
    callId: longToStringSchema,
    timestamp: longToNumberSchema,
    direction: z.nativeEnum(Proto.SyncMessage.CallEvent.Direction),
    event: z.nativeEnum(Proto.SyncMessage.CallEvent.Event),
  })
  .and(
    z.union([
      z.object({
        type: z
          .nativeEnum(Proto.SyncMessage.CallEvent.Type)
          .refine(val => val === Proto.SyncMessage.CallEvent.Type.AD_HOC_CALL),
        conversationId: roomIdInBytesSchema,
      }),
      z.object({
        type: z
          .nativeEnum(Proto.SyncMessage.CallEvent.Type)
          .refine(val => val !== Proto.SyncMessage.CallEvent.Type.AD_HOC_CALL),
        conversationId: conversationPeerIdInBytesSchema,
      }),
    ])
  );

const CALL_LOG_EVENT_TYPE_MAP: Record<
  Proto.SyncMessage.CallLogEvent.Type,
  CallLogEvent
> = {
  [Proto.SyncMessage.CallLogEvent.Type.CLEAR]: CallLogEvent.Clear,
  [Proto.SyncMessage.CallLogEvent.Type.CLEAR_IN_CONVERSATION]:
    CallLogEvent.UNIMPLEMENTED_ClearInConversation,
  [Proto.SyncMessage.CallLogEvent.Type.MARKED_AS_READ]:
    CallLogEvent.MarkedAsRead,
  [Proto.SyncMessage.CallLogEvent.Type.MARKED_AS_READ_IN_CONVERSATION]:
    CallLogEvent.MarkedAsReadInConversation,
};

const callLogEventTypeNormalizeSchema = z
  .enum(Proto.SyncMessage.CallLogEvent.Type)
  .transform(type => {
    const result = CALL_LOG_EVENT_TYPE_MAP[type];
    strictAssert(result, `Missing CALL_LOG_EVENT_TYPE_MAP for ${type}`);
    return result;
  });

export const callLogEventNormalizeSchema = z.object({
  type: callLogEventTypeNormalizeSchema,
  targetTimestamp: longToNumberSchema,
  peerIdAsConversationId: conversationPeerIdInBytesSchema.nullable(),
  peerIdAsRoomId: roomIdInBytesSchema.nullable(),
  callId: longToStringSchema.nullable(),
  eventTimestamp: z.number(),
}) satisfies z.ZodType<CallLogEventDetails>;

export function isSameCallHistoryGroup(
  a: CallHistoryGroup,
  b: CallHistoryGroup
): boolean {
  return (
    a.peerId === b.peerId &&
    a.timestamp === b.timestamp &&
    // For a bit more safety.
    a.mode === b.mode &&
    a.type === b.type &&
    a.direction === b.direction &&
    a.status === b.status
  );
}
