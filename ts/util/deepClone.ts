// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { WritableDeep } from 'type-fest';

/**
 * Takes a readonly object and returns a writable deep clone of it.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
 */
export function deepClone<T>(value: T): WritableDeep<T> {
  return structuredClone(value) as WritableDeep<T>;
}
