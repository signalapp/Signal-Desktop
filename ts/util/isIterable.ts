// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    (typeof value === 'object' && value !== null && Symbol.iterator in value) ||
    typeof value === 'string'
  );
}
