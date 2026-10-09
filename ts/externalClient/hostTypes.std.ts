// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServerKeyType } from './auth.node.ts';
import type {
  CapabilityType,
  ErrorCodeType,
  SendBlockReasonType,
  ServiceMethodType,
  SessionStatusType,
} from './protocol.std.ts';

// What the transport/session layer needs from Signal. The main process
// provides real implementations; tests provide fakes.

export type GrantType = Readonly<{
  publicKey: string;
  fingerprint: string;
  displayName: string;
  capabilities: ReadonlyArray<CapabilityType>;
  approvedAt: number;
  lastSeenAt: number | null;
}>;

export type ApprovalRequestType = Readonly<{
  publicKey: string;
  fingerprint: string;
  displayName: string;
  capabilities: ReadonlyArray<CapabilityType>;
}>;

export type ApprovalResultType =
  | Readonly<{ approved: true; grant: GrantType }>
  | Readonly<{ approved: false; reason: 'denied' | 'busy' | 'cooldown' }>;

export type ExternalClientAuthorityType = Readonly<{
  getServerKey: () => Promise<ServerKeyType>;
  findGrant: (publicKey: string) => Promise<GrantType | undefined>;
  // Asks the user in Signal's own UI. Never resolves to approved without a
  // user decision.
  requestApproval: (
    request: ApprovalRequestType
  ) => Promise<ApprovalResultType>;
  markSeen: (publicKey: string) => Promise<void>;
}>;

export type ServiceResultType =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; code: ErrorCodeType; reason?: SendBlockReasonType }>;

export type ExternalClientHostType = Readonly<{
  getStatus: () => Promise<SessionStatusType>;
  callService: (
    method: ServiceMethodType,
    params: unknown
  ) => Promise<ServiceResultType>;
}>;
