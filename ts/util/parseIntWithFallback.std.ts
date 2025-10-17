// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { parseIntOrThrow } from './parseIntOrThrow.std.js';

export function parseIntWithFallback(value: unknown, fallback: number): number {
  try {
    return parseIntOrThrow(value, 'Failed to parse');
  } catch (err) {
    return fallback;
  }
}
