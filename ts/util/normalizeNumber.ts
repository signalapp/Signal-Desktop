// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function normalizeNumber(value: number | Long): number;
export function normalizeNumber(value?: number | Long): number | undefined;

export function normalizeNumber(value?: number | Long): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  return value.toNumber();
}
