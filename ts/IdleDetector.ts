// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EventEmitter from 'events';
import * as log from './logging/log';
import { clearTimeoutIfNecessary } from './util/clearTimeoutIfNecessary';

const POLL_INTERVAL_MS = 5 * 1000;
const IDLE_THRESHOLD_MS = 20;

export class IdleDetector extends EventEmitter {
  private handle: undefined | ReturnType<typeof requestIdleCallback>;
  private timeoutId: undefined | ReturnType<typeof setTimeout>;

  public start(): void {
    log.info('Start idle detector');
    this.#scheduleNextCallback();
  }

  public stop(): void {
    if (!this.handle) {
      return;
    }

    log.info('Stop idle detector');
    this.#clearScheduledCallbacks();
  }

  #clearScheduledCallbacks() {
    if (this.handle) {
      cancelIdleCallback(this.handle);
      delete this.handle;
    }

    clearTimeoutIfNecessary(this.timeoutId);
    delete this.timeoutId;
  }

  #scheduleNextCallback() {
    this.#clearScheduledCallbacks();
    this.handle = window.requestIdleCallback(deadline => {
      const { didTimeout } = deadline;
      const timeRemaining = deadline.timeRemaining();
      const isIdle = timeRemaining >= IDLE_THRESHOLD_MS;
      this.timeoutId = setTimeout(
        () => this.#scheduleNextCallback(),
        POLL_INTERVAL_MS
      );
      if (isIdle || didTimeout) {
        this.emit('idle', { timestamp: Date.now(), didTimeout, timeRemaining });
      }
    });
  }
}
