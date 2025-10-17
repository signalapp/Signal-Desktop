// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const SECOND = 1000;

export const FIBONACCI: ReadonlyArray<number> = [1, 2, 3, 5, 8, 13, 21, 34, 55];

export const FIBONACCI_TIMEOUTS: ReadonlyArray<number> = [
  1 * SECOND,
  2 * SECOND,
  3 * SECOND,
  5 * SECOND,
  8 * SECOND,
  13 * SECOND,
  21 * SECOND,
  34 * SECOND,
  55 * SECOND,
];

export const EXTENDED_FIBONACCI_TIMEOUTS: ReadonlyArray<number> = [
  ...FIBONACCI_TIMEOUTS,
  89 * SECOND,
  144 * SECOND,
  233 * SECOND,
  377 * SECOND,
  610 * SECOND,
  987 * SECOND,
  1597 * SECOND, // ~26 minutes
];

export type BackOffOptionsType = Readonly<{
  jitter?: number;

  // Testing
  random?: () => number;
}>;

const DEFAULT_RANDOM = () => Math.random();

export class BackOff {
  #count = 0;

  constructor(
    private timeouts: ReadonlyArray<number>,
    private readonly options: BackOffOptionsType = {}
  ) {}

  public get(): number {
    let result = this.timeouts[this.#count];
    const { jitter = 0, random = DEFAULT_RANDOM } = this.options;

    // Do not apply jitter larger than the timeout value. It is supposed to be
    // activated for longer timeouts.
    if (jitter < result) {
      result += random() * jitter;
    }
    return result;
  }

  public getAndIncrement(): number {
    const result = this.get();
    if (!this.isFull()) {
      this.#count += 1;
    }

    return result;
  }

  public reset(newTimeouts?: ReadonlyArray<number>): void {
    if (newTimeouts !== undefined) {
      this.timeouts = newTimeouts;
    }
    this.#count = 0;
  }

  public isFull(): boolean {
    return this.#count === this.timeouts.length - 1;
  }

  public getIndex(): number {
    return this.#count;
  }
}
