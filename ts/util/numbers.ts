// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { strictAssert } from './assert';

export function safeParseNumber(value: number | string): number | null {
  if (typeof value === 'number') {
    return value;
  }
  strictAssert(typeof value === 'string', 'Expected string or number');
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (parsed < Number.MIN_SAFE_INTEGER || parsed > Number.MAX_SAFE_INTEGER) {
    return null;
  }
  return parsed;
}

export function safeParseInteger(
  value: number | string,
  trunc = false
): number | null {
  const parsed = safeParseNumber(value);
  if (parsed == null) {
    return null;
  }
  if (trunc) {
    return Math.trunc(parsed);
  }
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
}

export function safeParseBigint(
  value: bigint | number | string
): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      return null;
    }
    return BigInt(value);
  }
  strictAssert(typeof value === 'string', 'Expected string, number, or bigint');
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  return BigInt(value);
}

export function roundFractionForProgressBar(fractionComplete: number): number {
  if (fractionComplete <= 0) {
    return 0;
  }

  if (fractionComplete >= 1) {
    return 1;
  }

  if (fractionComplete <= 0.01) {
    return 0.01;
  }

  if (fractionComplete >= 0.99) {
    return 0.99;
  }

  return Math.round(fractionComplete * 100) / 100;
}
