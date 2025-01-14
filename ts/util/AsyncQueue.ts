// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { once, noop } from 'lodash';

/**
 * You can do two things with an async queue:
 *
 * 1. Put values in.
 * 2. Consume values out in the order they were added.
 *
 * Values are removed from the queue when they're consumed.
 *
 * There can only be one consumer, though this could be changed.
 *
 * See the tests to see how this works.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  #onAdd: () => void = noop;
  #queue: Array<T> = [];
  #isReading = false;

  add(value: Readonly<T>): void {
    this.#queue.push(value);
    this.#onAdd();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    if (this.#isReading) {
      throw new Error('Cannot iterate over a queue more than once');
    }
    this.#isReading = true;

    while (true) {
      yield* this.#queue;

      this.#queue = [];

      // We want to iterate over the queue in series.
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>(resolve => {
        this.#onAdd = once(resolve);
      });
    }
  }
}
