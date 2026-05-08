// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useState } from 'react';

type TimerKey = ReturnType<typeof setTimeout>;
type TimerCancel = () => void;

class Timers {
  readonly #pending = new Set<TimerKey>();

  /**
   * Add a new timer to the set.
   *
   * Call `timers.cancelAll()` first if you would like to replace previous timers.
   *
   * @example
   * ```tsx
   * const timers = new Timers(); // or useTimers()
   *
   * // Cancel any pending timers if you want to replace them:
   * timers.cancelAll();
   *
   * // Create a new timer that waits 1 second:
   * const cancel = timers.add(1000, () => {
   *   console.log("Waited a second")
   * });
   *
   * // Later if we would like to cancel this specific timer:
   * if (shouldCancel) {
   *   cancel();
   * }
   * ```
   */
  add(milliseconds: number, callback: () => void): TimerCancel {
    const key = setTimeout(() => {
      this.#pending.delete(key);
      callback();
    }, milliseconds);

    this.#pending.add(key);

    return () => {
      clearTimeout(key);
      this.#pending.delete(key);
    };
  }

  /**
   * Cancels all pending timers in the set.
   */
  cancelAll(): void {
    this.#pending.forEach(id => clearTimeout(id));
    this.#pending.clear();
  }
}

/** @testexport */
export { Timers as _Timers };

/**
 * Create a `Timers` instance and clean it up when the component unrenders.
 */
export function useTimers(): Timers {
  const [timers] = useState(() => new Timers());

  useEffect(() => {
    return () => timers.cancelAll();
  }, [timers]);

  return timers;
}
