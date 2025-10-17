// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import EventEmitter from 'node:events';

import {
  hasBuildExpired,
  getBuildExpirationTimestamp,
} from '../util/buildExpiration.std.js';
import { LongTimeout } from '../util/timeout.std.js';
import { createLogger } from '../logging/log.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const log = createLogger('buildExpiration');

export class BuildExpirationService extends EventEmitter {
  constructor() {
    super();

    // Let API users subscribe to `expired` event before firing it.
    queueMicrotask(() => this.#startTimer());
  }

  hasBuildExpired(): boolean {
    const autoDownloadUpdate = itemStorage.get('auto-download-update', true);

    return hasBuildExpired({
      buildExpirationTimestamp: this.#getBuildExpirationTimestamp(),
      autoDownloadUpdate,
      now: Date.now(),
      logger: log,
    });
  }

  // Private

  #getBuildExpirationTimestamp(): number {
    const autoDownloadUpdate = itemStorage.get('auto-download-update', true);

    return getBuildExpirationTimestamp({
      version: window.getVersion(),
      packagedBuildExpiration: window.getBuildExpiration(),
      remoteBuildExpiration: itemStorage.get('remoteBuildExpiration'),
      autoDownloadUpdate,
      logger: log,
    });
  }

  #startTimer(): void {
    const timestamp = this.#getBuildExpirationTimestamp();
    const now = Date.now();
    if (timestamp <= now) {
      if (this.hasBuildExpired()) {
        log.warn('expired');
        this.emit('expired');
      }
      return;
    }

    const delayMs = timestamp - now;
    log.info(`expires in ${delayMs}ms`);

    // eslint-disable-next-line no-new
    new LongTimeout(() => {
      if (this.hasBuildExpired()) {
        log.warn('expired');
        this.emit('expired');
      } else {
        this.#startTimer();
      }
    }, delayMs);
  }

  // EventEmitter types

  public override on(type: 'expired', callback: () => void): this;

  public override on(
    type: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...args: Array<any>) => void
  ): this {
    return super.on(type, listener);
  }

  public override emit(type: 'expired'): boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public override emit(type: string | symbol, ...args: Array<any>): boolean {
    return super.emit(type, ...args);
  }
}
