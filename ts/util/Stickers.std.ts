// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const VALID_PACK_ID_REGEXP = /^[0-9a-f]{32}$/i;

export function isPackIdValid(packId: unknown): packId is string {
  return typeof packId === 'string' && VALID_PACK_ID_REGEXP.test(packId);
}

export function redactPackId(packId: string): string {
  return `[REDACTED]${packId.slice(-3)}`;
}
