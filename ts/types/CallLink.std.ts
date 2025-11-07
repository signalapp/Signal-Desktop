// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallLink feature removed - stub only

export type CallLinkType = never;
export type CallLinkStateType = never;

export enum CallLinkUpdateSyncType {
  Update = 'Update',
  Delete = 'Delete',
}

export type CallLinkRecord = {
  roomId: string;
  rootKey: Uint8Array | null;
  epoch: Uint8Array | null;
  adminKey: Uint8Array | null;
  name: string;
  restrictions: number;
  revoked: number;
  expiration: number | null;
  storageID: string | null;
  storageVersion: number | null;
  storageUnknownFields: Uint8Array | null;
  storageNeedsSync: number;
};

export type DefunctCallLinkType = unknown;
export type PendingCallLinkType = unknown;

export enum CallLinkRestrictions {
  None = 0,
  AdminApproval = 1,
  Unknown = 2,
}

export function toCallLinkRestrictions(value: unknown): CallLinkRestrictions {
  if (value === 0) return CallLinkRestrictions.None;
  if (value === 1) return CallLinkRestrictions.AdminApproval;
  return CallLinkRestrictions.Unknown;
}

export function isCallLinkAdmin(): boolean {
  return false;
}
