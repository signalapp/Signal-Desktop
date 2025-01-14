// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import PQueue from 'p-queue';
import * as Errors from '../types/errors';
import * as log from '../logging/log';

type EntryType = Readonly<{
  value: number;
  callback(): Promise<void>;
}>;

let startupProcessingQueue: StartupQueue | undefined;

export class StartupQueue {
  readonly #map = new Map<string, EntryType>();

  readonly #running: PQueue = new PQueue({
    // mostly io-bound work that is not very parallelizable
    // small number should be sufficient
    concurrency: 5,
  });

  public add(id: string, value: number, f: () => Promise<void>): void {
    const existing = this.#map.get(id);
    if (existing && existing.value >= value) {
      return;
    }

    this.#map.set(id, { value, callback: f });
  }

  public flush(): void {
    log.info('StartupQueue: Processing', this.#map.size, 'actions');

    const values = Array.from(this.#map.values());
    this.#map.clear();

    for (const { callback } of values) {
      void this.#running.add(async () => {
        try {
          return callback();
        } catch (error) {
          log.error(
            'StartupQueue: Failed to process item due to error',
            Errors.toLogFormat(error)
          );
          throw error;
        }
      });
    }
  }

  #shutdown(): Promise<void> {
    log.info(
      `StartupQueue: Waiting for ${this.#running.pending} tasks to drain`
    );
    return this.#running.onIdle();
  }

  static initialize(): void {
    startupProcessingQueue = new StartupQueue();
  }

  static isAvailable(): boolean {
    return Boolean(startupProcessingQueue);
  }

  static add(id: string, value: number, f: () => Promise<void>): void {
    startupProcessingQueue?.add(id, value, f);
  }

  static flush(): void {
    startupProcessingQueue?.flush();
    startupProcessingQueue = undefined;
  }

  static async shutdown(): Promise<void> {
    if (startupProcessingQueue != null) {
      await startupProcessingQueue.#shutdown();
    }
  }
}
