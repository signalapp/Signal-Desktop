// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * An error class representing an assertion that failed.
 * @example
 * ```ts
 * function example(value: number) {
 *   assert(Number.isSafeInteger(value))
 *   // >> AssertionError: Value is not an integer
 * }
 * ```
 */
class AssertionError extends TypeError {
  override name = 'AssertionError';
}

/**
 * Assert a condition is true.
 * @example
 * ```ts
 * function example(value: number) {
 *   assert(Number.isSafeInteger(value)) // throws if not safe integer
 *   // ...
 * }
 * ```
 *
 * Can alternatively be used to assert a value is not null or undefined,
 * returning the non-nullable value.
 * @example
 * ```ts
 * function example(value: string | null | undefined) {
 *   let result = assert(value) // asserts is not null or undefined
 *   result.toUpperCase() // string
 * }
 * ```
 *
 * Optionally provide a message:
 * @example
 * ```ts
 * function example(value: number) {
 *   assert(Number.isSafeInteger(value), "Value is not an integer")
 *   // >> AssertionError: Value is not an integer
 *   // ...
 * }
 * ```
 */
export function assert(condition: boolean, message?: string): asserts condition;

/**
 * Assert a value is not null or undefined, returning the non-nullable value.
 * @example
 * ```ts
 * function example(value: string | null | undefined) {
 *   let result = assert(value) // asserts is not null or undefined
 *   result.toUpperCase() // string
 * }
 *
 * ```
 *
 * Can alternatively be used to assert a condition is true.
 * @example
 * ```ts
 * function example(value: number) {
 *   assert(Number.isSafeInteger(value)) // throws if not safe integer
 *   // ...
 * }
 * ```
 *
 * Optionally provide a message:
 * @example
 * ```ts
 * function example(value: string | null | undefined) {
 *   let result = assert(value, "Missing value")
 *   // >> AssertionError: Missing value
 *   result.toUpperCase() // string
 * }
 * ```
 */
export function assert<T>(input: T, message?: string): NonNullable<T>;
export function assert<T>(input: T, message?: string): NonNullable<T> {
  if (input === false || input == null) {
    // oxlint-disable-next-line no-debugger
    debugger;
    // oxlint-disable-next-line typescript/restrict-template-expressions
    throw new AssertionError(message ?? `input is ${input}`);
  }
  return input;
}

/**
 * Assert that a state should never be reached.
 *
 * Can be used to make an exhaustive check on a value.
 *
 * @example
 * ```tsx
 * function example(value: 'one' | 'two') {
 *   if (value === 'one') {
 *     // ...
 *   } else if (value === 'two') {
 *     // ...
 *   } else {
 *     unreachable(value);
 *   }
 * }
 * ```
 */
export function unreachable(_value: never): never {
  // oxlint-disable-next-line no-debugger
  debugger;
  throw new AssertionError('unreachable');
}
