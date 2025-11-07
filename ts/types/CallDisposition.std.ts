// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallDisposition feature removed - stub only

export enum CallDirection {
  Incoming = 'Incoming',
  Outgoing = 'Outgoing',
}

export enum DirectCallStatus {
  Accepted = 'Accepted',
  Declined = 'Declined',
  Missed = 'Missed',
  Deleted = 'Deleted',
  Pending = 'Pending',
  MissedNotificationProfile = 'MissedNotificationProfile',
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
}

export type CallStatus = DirectCallStatus | GroupCallStatus | AdhocCallStatus;

export enum CallType {
  Audio = 'Audio',
  Video = 'Video',
  Group = 'Group',
  Adhoc = 'Adhoc',
}

export enum CallMode {
  Direct = 'Direct',
  Group = 'Group',
  Adhoc = 'Adhoc',
}

export type CallHistoryDetails = never;
export type CallHistoryGroup = never;
export type CallHistoryPagination = never;
export type CallHistoryFilter = never;
