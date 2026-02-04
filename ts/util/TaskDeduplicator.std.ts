// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strictAssert } from './assert.std.js';
import { explodePromise } from './explodePromise.std.js';

// A wrapper class around a task that should not run concurrently.
// `TaskDeduplicator` takes `abortSignal` for each `run` and thus lets you
// cancel both individual invocations and the deduplicated actual task function
// run.
//
// Usage:
//
//   const task = new TaskDeduplicator('myTask', async (abortSignal) => {
//     await sleep(1000, abortSignal);
//   });
//
//   await task.run();
//   await task.run(otherAbortSignal);
//
export class TaskDeduplicator<Result = void> {
  #task: (abortSignal: AbortSignal) => Promise<Result>;
  #current: Promise<Result> | undefined;
  #remaining = 0;
  #abortController: AbortController | undefined;

  constructor(
    public readonly name: string,
    task: (abortSignal: AbortSignal) => Promise<Result>
  ) {
    this.#task = task;
  }

  async run(abortSignal?: AbortSignal): Promise<Result> {
    const { promise: localAbort, reject: localReject } =
      explodePromise<Result>();

    if (abortSignal != null) {
      this.#remaining += 1;
      abortSignal.addEventListener('abort', () => {
        this.#remaining -= 1;
        if (this.#remaining === 0) {
          strictAssert(
            this.#abortController != null,
            `TaskDeduplicator(${this.name}): missing abort controller`
          );
          this.#abortController.abort();
        }

        localReject(new Error('Aborted'));
      });
    }

    if (this.#current != null) {
      return Promise.race([this.#current, localAbort]);
    }

    this.#abortController = new AbortController();

    try {
      this.#current = this.#task(this.#abortController.signal);
      return await Promise.race([this.#current, localAbort]);
    } finally {
      this.#current = undefined;
      this.#abortController = undefined;
      this.#remaining = 0;
    }
  }
}
