// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * This class tries to enforce a state machine that looks something like this:
 *
 * .--------------------.  called   .-----------.  called  .---------------------.
 * |                    | --------> |           | -------> |                     |
 * | Nothing is running |           | 1 running |          | 1 running, 1 queued |
 * |                    | <-------- |           | <------- |                     |
 * '--------------------'   done    '-----------'   done   '---------------------'
 *                                                             |           ^
 *                                                             '-----------'
 *                                                                called
 *
 * Most notably, if something is queued and the function is called again, we discard the
 *   previously queued task completely.
 */

import { drop } from './drop';

export class LatestQueue {
  #isRunning: boolean;
  #queuedTask?: () => Promise<void>;
  #onceEmptyCallbacks: Array<() => unknown>;

  constructor() {
    this.#isRunning = false;
    this.#onceEmptyCallbacks = [];
  }

  /**
   * Does one of the following:
   *
   * 1. Runs the task immediately.
   * 2. Enqueues the task, destroying any previously-enqueued task. In other words, 0 or 1
   *    tasks will be enqueued at a time.
   */
  add(task: () => Promise<void>): void {
    if (this.#isRunning) {
      this.#queuedTask = task;
    } else {
      this.#isRunning = true;
      drop(
        task().finally(() => {
          this.#isRunning = false;

          const queuedTask = this.#queuedTask;
          if (queuedTask) {
            this.#queuedTask = undefined;
            this.add(queuedTask);
          } else {
            try {
              this.#onceEmptyCallbacks.forEach(callback => {
                callback();
              });
            } finally {
              this.#onceEmptyCallbacks = [];
            }
          }
        })
      );
    }
  }

  /**
   * Adds a callback to be called the first time the queue goes from "running" to "empty".
   */
  onceEmpty(callback: () => unknown): void {
    this.#onceEmptyCallbacks.push(callback);
  }
}
