// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallDisposition feature removed - stub only

export enum CallDirection {
  Incoming = 'Incoming',
  Outgoing = 'Outgoing',
  Unknown = 'Unknown',
}

export enum DirectCallStatus {
  Accepted = 'Accepted',
  Declined = 'Declined',
  Missed = 'Missed',
  Deleted = 'Deleted',
  Pending = 'Pending',
  MissedNotificationProfile = 'MissedNotificationProfile',
  Unknown = 'Unknown',
}

export enum GroupCallStatus {
  Accepted = 'Accepted',
  Declined = 'Declined',
  Missed = 'Missed',
  Joined = 'Joined',
  Ringing = 'Ringing',
  GenericGroupCall = 'GenericGroupCall',
  OutgoingRing = 'OutgoingRing',
  Deleted = 'Deleted',
  MissedNotificationProfile = 'MissedNotificationProfile',
}

export enum AdhocCallStatus {
  Generic = 'Generic',
  Unknown = 'Unknown',
  Deleted = 'Deleted',
  Joined = 'Joined',
  Pending = 'Pending',
}

export type CallStatus = DirectCallStatus | GroupCallStatus | AdhocCallStatus;

export enum CallType {
  Audio = 'Audio',
  Video = 'Video',
  Group = 'Group',
  Adhoc = 'Adhoc',
  Unknown = 'Unknown',
}

export enum CallMode {
  Direct = 'Direct',
  Group = 'Group',
  Adhoc = 'Adhoc',
}

export type CallHistoryDetails = {
  callId: string;
  type: CallType;
  peerId: string;
  status: CallStatus;
  timestamp: number;
  [key: string]: unknown;
};

export type CallHistoryGroup = never;
export type CallHistoryPagination = never;
export type CallHistoryFilter = never;

// Additional types required by various modules
export type CallLogEventTarget = never;
export type CallStatusValue = CallStatus;
export type CallHistoryFilterStatus = never;
export type CallEventDetails = never;
export type CallLogEventDetails = never;
export type CallDetails = never;

// Schema stubs for migrations
export const callHistoryDetailsSchema = {
  parse: (_data: unknown): CallHistoryDetails => {
    throw new Error('Call history not supported');
  },
};

export const callHistoryGroupSchema = {
  parse: (_data: unknown): never => {
    throw new Error('Call history not supported');
  },
};
