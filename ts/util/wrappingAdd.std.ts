// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// Add two unsigned 24-bit integers and return truncated 24-bit result
export function wrappingAdd24(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error('Invalid arguments');
  }

  // eslint-disable-next-line no-bitwise
  return (a + b) & 0xffffff;
}
