// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';
import Long from 'long';
import { CallMode } from './Calling';
import type { AciString } from './ServiceId';
import { aciSchema } from './ServiceId';
import { bytesToUuid } from '../util/uuidToBytes';
import { SignalService as Proto } from '../protobuf';
import * as Bytes from '../Bytes';

export enum CallType {
  Audio = 'Audio',
  Video = 'Video',
  Group = 'Group',
}

export enum CallDirection {
  Incoming = 'Incoming',
  Outgoing = 'Outgoing',
}

export enum CallLogEvent {
  Clear = 'Clear',
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
}

export type CallEvent = LocalCallEvent | RemoteCallEvent;

export enum DirectCallStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Missed = 'Missed',
  Declined = 'Declined',
  Deleted = 'Deleted',
}

export enum GroupCallStatus {
  GenericGroupCall = 'GenericGroupCall',
  OutgoingRing = 'OutgoingRing',
  Ringing = 'Ringing',
  Joined = 'Joined',
  // keep these in sync with direct
  Accepted = DirectCallStatus.Accepted,
  Missed = DirectCallStatus.Missed,
  Declined = DirectCallStatus.Declined,
  Deleted = DirectCallStatus.Deleted,
}

export type CallStatus = DirectCallStatus | GroupCallStatus;

export type CallDetails = Readonly<{
  callId: string;
  peerId: AciString | string;
  ringerId: AciString | string | null;
  mode: CallMode;
  type: CallType;
  direction: CallDirection;
  timestamp: number;
}>;

export type CallEventDetails = CallDetails &
  Readonly<{
    event: CallEvent;
    eventSource: string;
  }>;

export type CallHistoryDetails = CallDetails &
  Readonly<{
    status: CallStatus;
  }>;

export type CallHistoryGroup = Omit<CallHistoryDetails, 'callId' | 'ringerId'> &
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
  conversationIds: ReadonlyArray<string> | null;
}>;

export type CallHistoryPagination = Readonly<{
  offset: number;
  limit: number;
}>;

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
]);

export const callDetailsSchema = z.object({
  callId: z.string(),
  peerId: z.string(),
  ringerId: ringerIdSchema,
  mode: callModeSchema,
  type: callTypeSchema,
  direction: callDirectionSchema,
  timestamp: z.number(),
}) satisfies z.ZodType<CallDetails>;

export const callEventDetailsSchema = callDetailsSchema.extend({
  event: callEventSchema,
  eventSource: z.string(),
}) satisfies z.ZodType<CallEventDetails>;

export const callHistoryDetailsSchema = callDetailsSchema.extend({
  status: callStatusSchema,
}) satisfies z.ZodType<CallHistoryDetails>;

export const callHistoryGroupSchema = z.object({
  peerId: z.string(),
  mode: callModeSchema,
  type: callTypeSchema,
  direction: callDirectionSchema,
  status: callStatusSchema,
  timestamp: z.number(),
  children: z.array(
    z.object({
      callId: z.string(),
      timestamp: z.number(),
    })
  ),
}) satisfies z.ZodType<CallHistoryGroup>;

const peerIdInBytesSchema = z.instanceof(Uint8Array).transform(value => {
  const uuid = bytesToUuid(value);
  if (uuid != null) {
    return uuid;
  }
  // assuming groupId
  return Bytes.toBase64(value);
});

const longToStringSchema = z
  .instanceof(Long)
  .transform(long => long.toString());

const longToNumberSchema = z
  .instanceof(Long)
  .transform(long => long.toNumber());

export const callEventNormalizeSchema = z.object({
  peerId: peerIdInBytesSchema,
  callId: longToStringSchema,
  timestamp: longToNumberSchema,
  type: z.nativeEnum(Proto.SyncMessage.CallEvent.Type),
  direction: z.nativeEnum(Proto.SyncMessage.CallEvent.Direction),
  event: z.nativeEnum(Proto.SyncMessage.CallEvent.Event),
});

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
