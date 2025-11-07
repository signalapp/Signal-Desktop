// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: callLinksLoader removed - stub only

export class CallLinksLoader {
  // Stub implementation
}

export const callLinksLoader = new CallLinksLoader();

export async function loadCallLinks(): Promise<void> {
  // No-op
}

export function getCallLinksForRedux(): Array<unknown> {
  return [];
}
