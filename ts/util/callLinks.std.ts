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

export function getKeyFromCallLink(): string {
  return '';
}
