// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function toNumber(input: bigint): number;
export function toNumber(
  input: number | bigint | null | undefined
): number | null;

export function toNumber(
  input: number | bigint | null | undefined
): number | null {
  if (input == null) {
    return null;
  }
  if (typeof input === 'bigint') {
    return Number(input);
  }
  if (Number.isFinite(input)) {
    return input;
  }
  return null;
}
