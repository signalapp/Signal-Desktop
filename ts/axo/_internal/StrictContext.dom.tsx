// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Context } from 'react';
import { createContext, useContext } from 'react';

const EMPTY: unique symbol = Symbol('STRICT_CONTEXT_EMPTY');
const WRAPPER: unique symbol = Symbol('STRICT_CONTEXT_MESSAGE');

/**
 * A React context that throws if consumed outside its provider,
 * rather than silently returning `undefined`.
 */
export type StrictContext<T> = Context<T | typeof EMPTY> & {
  [WRAPPER]: string;
};

/**
 * Similar to `createContext()` but does not accept a nullable value in
 * `Provider`.
 *
 * Use with `useStrictContext()` to assert that the component is wrapped with a
 * provider.
 */
export function createStrictContext<T>(wrapper: string): StrictContext<T> {
  return Object.assign(createContext<T | typeof EMPTY>(EMPTY), {
    [WRAPPER]: wrapper,
  });
}

/**
 * Similar to `useContext()` but throws a descriptive error if the component is
 * not wrapped with a provider.
 */
export function useStrictContext<T>(
  context: StrictContext<T>,
  message?: string
): T {
  const value = useContext(context);
  if (value === EMPTY) {
    throw new Error(message ?? `Must be wrapped with <${context[WRAPPER]}>`);
  }
  return value;
}
