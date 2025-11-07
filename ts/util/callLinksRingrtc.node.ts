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

export function getRoomIdFromCallLink(): string {
  return '';
}

export function getRoomIdFromRootKeyString(): string {
  return '';
}

export function toEpochBytes(): Uint8Array {
  return new Uint8Array();
}

export function fromEpochBytes(): string {
  return '';
}

export function toRootKeyBytes(): Uint8Array {
  return new Uint8Array();
}

export function fromRootKeyBytes(): string {
  return '';
}

export function callLinkFromRecord(): never {
  throw new Error('Call links not supported');
}
