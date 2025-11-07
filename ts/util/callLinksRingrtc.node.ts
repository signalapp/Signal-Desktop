// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Call links ringrtc removed - stub only

export function toRingrtcCallLinkState(): never {
  throw new Error('Call links not supported');
}

export function fromRingrtcCallLinkState(): never {
  throw new Error('Call links not supported');
}

export function getRoomIdFromRootKey(): string {
  return '';
}
