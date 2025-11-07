// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: CallLink feature removed - stub only

export type CallLinkType = never;
export type CallLinkStateType = never;

export enum CallLinkRestrictions {
  None = 0,
  AdminApproval = 1,
  Unknown = 2,
}

export function isCallLinkAdmin(): boolean {
  return false;
}
