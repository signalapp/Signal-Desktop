// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConditionalKeys } from 'type-fest';

import type { StorageAccessType } from '../types/Storage.d.ts';
import { toLogFormat } from '../types/errors.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { createLogger } from '../logging/log.std.js';
import { LongTimeout } from './timeout.std.js';
import { drop } from './drop.std.js';
import { BackOff, FIBONACCI_TIMEOUTS } from './BackOff.std.js';

const log = createLogger('CheckScheduler');

export type CheckSchedulerOptionsType = Readonly<{
  name: string;
  interval: number;
  storageKey: ConditionalKeys<StorageAccessType, number>;
  backOffTimeouts?: ReadonlyArray<number>;
  callback: () => Promise<void>;
}>;

export class CheckScheduler {
  #options: CheckSchedulerOptionsType;
  #log: ReturnType<typeof createLogger>;
  #timer: LongTimeout | undefined;
  #isRunning = false;

  constructor(options: CheckSchedulerOptionsType) {
    this.#options = options;
    this.#log = log.child(options.name);
  }

  start(): void {
    if (this.#isRunning) {
      throw new Error(
        `CheckScheduler(${this.#options.name}) is already running`
      );
    }
    this.#isRunning = true;
    this.#scheduleCheck();
  }

  async runAt(timestamp: number): Promise<void> {
    await itemStorage.put(
      this.#options.storageKey,
      timestamp - this.#options.interval
    );

    this.#scheduleCheck();
  }

  async delayBy(ms: number): Promise<void> {
    const earliestCheck = Date.now() + ms;

    const lastCheckTimestamp = itemStorage.get(this.#options.storageKey, 0);
    await itemStorage.put(
      this.#options.storageKey,
      Math.max(lastCheckTimestamp, earliestCheck - this.#options.interval)
    );

    this.#scheduleCheck();
  }

  #scheduleCheck(): void {
    const now = Date.now();
    const lastCheckTimestamp = itemStorage.get(
      this.#options.storageKey,
      // Gracefully rollout when polling initially
      now - this.#options.interval * Math.random()
    );
    const delay = Math.max(
      0,
      lastCheckTimestamp + this.#options.interval - now
    );
    this.#timer?.clear();
    this.#timer = undefined;
    if (delay === 0) {
      this.#log.info('running the check immediately');
      drop(this.#safeCheck());
    } else {
      this.#log.info(`running the check in ${delay}ms`);
      this.#timer = new LongTimeout(() => drop(this.#safeCheck()), delay);
    }
  }

  async #safeCheck(
    backOff = new BackOff(this.#options.backOffTimeouts ?? FIBONACCI_TIMEOUTS)
  ): Promise<void> {
    try {
      await this.#options.callback();
      await itemStorage.put(this.#options.storageKey, Date.now());

      this.#scheduleCheck();
    } catch (error) {
      this.#log.error('check failed with error', toLogFormat(error));
      this.#timer = new LongTimeout(
        () => drop(this.#safeCheck()),
        backOff.getAndIncrement()
      );
    }
  }
}
