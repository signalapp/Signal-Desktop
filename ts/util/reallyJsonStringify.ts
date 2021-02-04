// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Returns `JSON.stringify(value)` if that returns a string, otherwise returns a value
 * like `[object Object]` or `[object Undefined]`.
 *
 * `JSON.stringify` doesn't always return a string. Some examples:
 *
 *     JSON.stringify(undefined) === undefined
 *
 *     JSON.stringify(Symbol()) === undefined
 *
 *     JSON.stringify({ toJSON() {} }) === undefined
 *
 *     const a = {};
 *     const b = { a };
 *     a.b = a;
 *     JSON.stringify(a);  // => Throws a TypeError
 *
 *     JSON.stringify(123n);  // => Throws a TypeError
 *
 *     const scary = {
 *       toJSON() {
 *         throw new Error('uh oh');
 *       }
 *     };
 *     JSON.stringify(scary);  // => Throws "uh oh"
 *
 * This makes sure we return a string and don't throw.
 */
export function reallyJsonStringify(value: unknown): string {
  let result: unknown;
  try {
    result = JSON.stringify(value);
  } catch (_err) {
    result = undefined;
  }

  return typeof result === 'string'
    ? result
    : Object.prototype.toString.call(value);
}
