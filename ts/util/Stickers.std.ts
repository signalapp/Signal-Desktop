// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as Bytes from '../Bytes.std.ts';

export const MAX_FAVORITE_STICKERS = 500;
export const MAX_STICKERS_PER_PACK = 1024;

const VALID_PACK_ID_REGEXP = /^[0-9a-f]{32}$/i;

export function isPackIdValid(packId: unknown): packId is string {
  return typeof packId === 'string' && VALID_PACK_ID_REGEXP.test(packId);
}

export function redactPackId(packId: string): string {
  return `[REDACTED]${packId.slice(-3)}`;
}

export function fromBase64PackKeyToHex(packKey: string): string {
  return Bytes.fromBase64(packKey).toHex();
}
