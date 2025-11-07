// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Call links SQL removed - stub only

import type { CallLinkRecord } from '../../types/CallLink.std.js';

export function getAllCallLinks(): ReadonlyArray<CallLinkRecord> {
  return [];
}

export function getCallLinkByRoomId(_roomId: string): CallLinkRecord | undefined {
  return undefined;
}

export function insertCallLink(_callLink: CallLinkRecord): CallLinkRecord {
  return _callLink;
}

export function updateCallLink(_callLink: Partial<CallLinkRecord>): void {
  // No-op
}

export function removeCallLink(_roomId: string): void {
  // No-op
}

export function clearAllCallLinks(): void {
  // No-op
}
