// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getEnvironment, Environment } from '../environment';
import * as log from '../logging/log';

/**
 * In production, logs an error and continues. In all other environments, throws an error.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    const err = new Error(message);
    if (getEnvironment() !== Environment.Production) {
      if (getEnvironment() === Environment.Development) {
        debugger; // eslint-disable-line no-debugger
      }
      throw err;
    }
    log.error('assert failure:', err && err.stack ? err.stack : err);
  }
}

/**
 * Throws an error if the condition is falsy, regardless of environment.
 */
export function strictAssert(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Asserts that the type of value is not a promise.
 * (Useful for database modules)
 */
export function assertSync<T, X>(value: T extends Promise<X> ? never : T): T {
  return value;
}
