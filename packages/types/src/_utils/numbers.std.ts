// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export function bigIntToNumber(input: bigint): number {
  if (input > MAX_SAFE_INTEGER_BIGINT) {
    throw new TypeError('must be <= MAX_SAFE_INTEGER');
  }

  return Number(input);
}

export function safeParseNumber(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export function safeParseBigInt(input: string): bigint | null {
  const trimmed = input.trim();
  if (trimmed === '') {
    return null;
  }
  try {
    return BigInt(input);
  } catch {
    return null;
  }
}
