// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { count, truncateAndSize } from './grapheme.std.js';
import { isBodyTooLong, trimBody } from './longAttachment.std.js';

export function truncateString(
  target: string,
  {
    byteLimit,
    graphemeLimit,
  }: { byteLimit?: number; graphemeLimit?: number } = {}
): string {
  let result = target;

  if (byteLimit && isBodyTooLong(result, byteLimit)) {
    result = trimBody(result, byteLimit);
  }

  if (graphemeLimit && count(result) > graphemeLimit) {
    [result] = truncateAndSize(result, graphemeLimit);
  }

  return result;
}
