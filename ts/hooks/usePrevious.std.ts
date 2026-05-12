// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react';

/**
 * This `usePrevious()` hook is safe in React concurrent mode and doesn't break
 * when rendered multiple times with the same values in `<StrictMode>`
 * Note: The previous value only updates when the value changes.
 * If you want to do work once after a change and track that it was done:
 * ```
 * const [counter, setCounter] = useState(0);
 * const lastAnimatedRef = useRef();
 *
 * useEffect(() => {
 *   if (counter === lastAnimatedRef.current) {
 *     return;
 *   }
 *   lastAnimatedRef.current = counter;
 *   // animate
 * }, [counter]);
 * ```
 */
export function usePrevious<T>(value: T): T | null {
  const [current, setCurrent] = useState<T>(value);
  const [previous, setPrevious] = useState<T | null>(null);
  if (current !== value) {
    setCurrent(value);
    setPrevious(current);
  }
  return previous;
}

// TODO: DESKTOP-10151
/** @deprecated */
export function usePreviousDeprecated<T>(initialValue: T, currentValue: T): T {
  const previousValueRef = useRef<T>(initialValue);
  const result = previousValueRef.current;
  previousValueRef.current = currentValue;
  return result;
}

/** @deprecated */
export function usePreviousEffect<T>(initialValue: T, currentValue: T): T {
  const previousValueRef = useRef<T>(initialValue);
  const result = previousValueRef.current;
  useEffect(() => {
    previousValueRef.current = currentValue;
  }, [currentValue]);
  return result;
}
