// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Context } from 'react';
import { createContext, useContext } from 'react';

const EMPTY: unique symbol = Symbol('STRICT_CONTEXT_EMPTY');
const WRAPPER: unique symbol = Symbol('STRICT_CONTEXT_MESSAGE');

export type StrictContext<T> = Context<T | typeof EMPTY> & {
  [WRAPPER]: string;
};

export function createStrictContext<T>(wrapper: string): StrictContext<T> {
  return Object.assign(createContext<T | typeof EMPTY>(EMPTY), {
    [WRAPPER]: wrapper,
  });
}

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
