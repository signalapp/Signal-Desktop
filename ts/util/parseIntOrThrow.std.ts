// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function parseIntOrThrow(value: unknown, message: string): number {
  let result: number;

  switch (typeof value) {
    case 'number':
      result = value;
      break;
    case 'string':
      result = parseInt(value, 10);
      break;
    default:
      result = NaN;
      break;
  }

  if (!Number.isInteger(result)) {
    throw new Error(message);
  }

  return result;
}
