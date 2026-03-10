// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export class AssertionError extends TypeError {
  override name = 'AssertionError';
}

export function assert(condition: boolean, message?: string): asserts condition;
export function assert<T>(input: T, message?: string): NonNullable<T>;
export function assert<T>(input: T, message?: string): NonNullable<T> {
  if (input === false || input == null) {
    // eslint-disable-next-line no-debugger
    debugger;
    throw new AssertionError(message ?? `input is ${input}`);
  }
  return input;
}

export function unreachable(_value: never): never {
  // eslint-disable-next-line no-debugger
  debugger;
  throw new AssertionError('unreachable');
}
