// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// ORBITAL: Call links removed - stub only

export function parseCallLinkUrl(): null {
  return null;
}

export function getPlaceholderCallLinkName(): string {
  return '';
}

export function toCallHistoryFromUnusedCallLink(): never {
  throw new Error('Call links not supported');
}

export function isCallHistoryForUnusedCallLink(): boolean {
  return false;
}

export function getKeyFromCallLink(_url: string): string {
  return '';
}

export function toAdminKeyBytes(_adminKey: string): Uint8Array {
  return new Uint8Array();
}

export function fromAdminKeyBytes(_adminKey: Uint8Array): string {
  return '';
}

export function getKeyAndEpochFromCallLink(_url: string): { key: string; epoch: string } | null {
  return null;
}
