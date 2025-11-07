// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Call disposition removed - stub only

export const getCallIdFromEra = (_eraId: string) => '';
export const getCallEventDetails = (_message: unknown, _ourAci: unknown) => null;
export async function updateLocalGroupCallHistoryTimestamp(
  _conversationId: string,
  _eraId: string,
  _createdAt: number
): Promise<void> {
  // Stub implementation
}

// Additional exports required by SendMessage and MessageReceiver
export function getCallEventForProto(_proto: unknown): null {
  return null;
}

export function getCallLogEventForProto(_proto: unknown): null {
  return null;
}

export function getBytesForPeerId(_peerId: unknown): Uint8Array {
  return new Uint8Array();
}

export function getCallIdForProto(_callId: unknown): string {
  return '';
}

export function getProtoForCallHistory(_callHistory: unknown): null {
  return null;
}
