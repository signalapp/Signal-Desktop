// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { setTimeout, clearTimeout } from 'timers';

export type Timeout = {
  id: number;
  __signalContext: never;
};

export class Timers {
  #counter = 0;
  readonly #timers = new Map<number, NodeJS.Timeout>();

  public setTimeout(callback: () => void, delay: number): Timeout {
    let id: number;
    do {
      id = this.#counter;
      // eslint-disable-next-line no-bitwise
      this.#counter = (this.#counter + 1) >>> 0;
    } while (this.#timers.has(id));

    const timer = setTimeout(() => {
      this.#timers.delete(id);
      callback();
    }, delay);

    this.#timers.set(id, timer);

    return { id } as unknown as Timeout;
  }

  public clearTimeout({ id }: Timeout): ReturnType<typeof clearTimeout> {
    const timer = this.#timers.get(id);
    if (timer === undefined) {
      return;
    }

    this.#timers.delete(id);
    return clearTimeout(timer);
  }
}
