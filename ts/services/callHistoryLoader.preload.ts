// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: callHistoryLoader removed - stub only

export class CallHistoryLoader {
  // Stub implementation
}

export const callHistoryLoader = new CallHistoryLoader();

export async function loadCallHistory(): Promise<void> {
  // No-op
}

export function getCallsHistoryForRedux(): Array<unknown> {
  return [];
}

export function getCallsHistoryUnreadCountForRedux(): number {
  return 0;
}
