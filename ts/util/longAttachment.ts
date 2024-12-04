// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { unicodeSlice } from './unicodeSlice';

const LONG_ATTACHMENT_LIMIT = 2048;

export function isBodyTooLong(body: string): boolean {
  return Buffer.byteLength(body) > LONG_ATTACHMENT_LIMIT;
}

export function trimBody(body: string, length = LONG_ATTACHMENT_LIMIT): string {
  const sliced = unicodeSlice(body, 0, length);

  if (sliced.length > 0) {
    return sliced;
  }

  // Failover, for degenerate cases
  return '\uFFFE';
}
