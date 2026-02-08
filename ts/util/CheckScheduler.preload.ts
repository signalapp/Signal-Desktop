// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConditionalKeys } from 'type-fest';

import type { StorageAccessType } from '../types/Storage.d.ts';
import { toLogFormat } from '../types/errors.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import { createLogger } from '../logging/log.std.js';
import { LongTimeout } from './timeout.std.js';
import { drop } from './drop.std.js';
import { strictAssert } from './assert.std.js';
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
    log.info(`Updating next run to ${new Date(timestamp).toISOString()}`);

    await itemStorage.put(
      this.#options.storageKey,
      timestamp - this.#options.interval
    );

    // Restart the timer if running
    if (this.#timer != null) {
      this.#scheduleCheck();
    }
  }

  async delayBy(ms: number): Promise<void> {
    const earliestCheck = Date.now() + ms;

    const lastCheckTimestamp = itemStorage.get(this.#options.storageKey, 0);
    const newTimestamp = Math.max(
      lastCheckTimestamp,
      earliestCheck - this.#options.interval
    );

    log.info(`Delaying next run until ${new Date(newTimestamp).toISOString()}`);

    await itemStorage.put(this.#options.storageKey, newTimestamp);

    // Restart the timer if running
    if (this.#timer != null) {
      this.#scheduleCheck();
    }
  }

  #scheduleCheck(): void {
    const now = Date.now();
    const lastCheckTimestamp = itemStorage.get(
      this.#options.storageKey,
      // Gracefully rollout when polling initially
      now - this.#options.interval * Math.random()
    );
    const targetTimestamp = lastCheckTimestamp + this.#options.interval;
    const delay = Math.max(0, targetTimestamp - now);
    if (this.#timer != null) {
      this.#timer.clear();
      this.#log.info('clearing previous timer');
    }
    this.#timer = undefined;
    if (delay === 0) {
      this.#log.info('running the check immediately');
      drop(this.#safeCheck());
    } else {
      this.#log.info(
        'running the check at',
        new Date(targetTimestamp).toISOString()
      );
      const timer = new LongTimeout(() => {
        strictAssert(
          this.#timer === timer,
          'Timer was canceled without clearing first'
        );
        this.#timer = undefined;
        drop(this.#safeCheck());
      }, delay);
      this.#timer = timer;
    }
  }

  async #safeCheck(
    backOff = new BackOff(this.#options.backOffTimeouts ?? FIBONACCI_TIMEOUTS)
  ): Promise<void> {
    try {
      const oldTimestamp = itemStorage.get(this.#options.storageKey);
      await this.#options.callback();

      // Allow callback to update the next scheduled time
      if (oldTimestamp === itemStorage.get(this.#options.storageKey)) {
        await itemStorage.put(this.#options.storageKey, Date.now());
      }

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
