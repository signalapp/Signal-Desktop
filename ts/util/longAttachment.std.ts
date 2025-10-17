// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { unicodeSlice } from './unicodeSlice.std.js';

const KIBIBYTE = 1024;
const MAX_MESSAGE_BODY_BYTE_LENGTH = 2 * KIBIBYTE;

export const MAX_BODY_ATTACHMENT_BYTE_LENGTH = 64 * KIBIBYTE;

export function isBodyTooLong(
  body: string,
  length = MAX_MESSAGE_BODY_BYTE_LENGTH
): boolean {
  return Buffer.byteLength(body) > length;
}

export function trimBody(
  body: string,
  length = MAX_MESSAGE_BODY_BYTE_LENGTH
): string {
  const sliced = unicodeSlice(body, 0, length);

  if (sliced.length > 0) {
    return sliced;
  }

  // Failover, for degenerate cases
  return '\uFFFE';
}
