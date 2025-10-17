// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createLogger } from '../logging/log.std.js';

const logging = createLogger('timeout');

const MAX_SAFE_TIMEOUT_DELAY = 2147483647; // max 32-bit signed integer

// Prefer using this function over setTimeout in any circumstances where
// the delay is not hardcoded to < MAX_SAFE_TIMEOUT_DELAY. Sets and returns a
// timeout if the delay is safe, otherwise does not set a timeout.
export function safeSetTimeout(
  callback: VoidFunction,
  providedDelayMs: number,
  options?: {
    clampToMax: boolean;
  }
): NodeJS.Timeout | null {
  let delayMs = providedDelayMs;

  if (delayMs < 0) {
    logging.warn('safeSetTimeout: timeout is less than zero');
    delayMs = 0;
  }

  if (delayMs > MAX_SAFE_TIMEOUT_DELAY) {
    if (options?.clampToMax) {
      delayMs = MAX_SAFE_TIMEOUT_DELAY;
    } else {
      logging.warn(
        'safeSetTimeout: timeout is larger than maximum setTimeout delay'
      );
      return null;
    }
  }

  return setTimeout(callback, delayMs);
}

// Set timeout for a delay that might be longer than MAX_SAFE_TIMEOUT_DELAY. The
// callback is guaranteed to execute after desired delay.
export class LongTimeout {
  #callback: VoidFunction;
  #fireTime: number;
  #timer: NodeJS.Timeout | undefined;

  constructor(callback: VoidFunction, providedDelayMs: number) {
    let delayMs = providedDelayMs;

    if (delayMs < 0) {
      logging.warn('safeSetTimeout: timeout is less than zero');
      delayMs = 0;
    }
    if (Number.isNaN(delayMs)) {
      throw new Error('NaN delayMs');
    }
    if (!Number.isFinite(delayMs)) {
      throw new Error('Infinite delayMs');
    }

    this.#callback = callback;
    this.#fireTime = Date.now() + delayMs;
    this.#schedule();
  }

  clear(): void {
    if (this.#timer != null) {
      clearTimeout(this.#timer);
    }
    this.#timer = undefined;
  }

  #schedule(): void {
    const remainingMs = this.#fireTime - Date.now();
    if (remainingMs <= MAX_SAFE_TIMEOUT_DELAY) {
      this.#timer = setTimeout(() => this.#fire(), remainingMs);
      return;
    }

    this.#timer = setTimeout(() => {
      this.#schedule();
    }, MAX_SAFE_TIMEOUT_DELAY);
  }

  #fire(): void {
    this.clear();
    this.#callback();
  }
}

export function longTimeoutAsync(
  ms: number,
  signal: AbortSignal | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = new LongTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      timeout.clear();
      reject(signal.reason);
    });
  });
}
