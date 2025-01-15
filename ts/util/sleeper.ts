// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import * as Errors from '../types/errors';

/**
 * Provides a way to delay tasks
 * but also a way to force sleeping tasks to immediately resolve/reject on shutdown
 */
export class Sleeper {
  #shuttingDown = false;
  #shutdownCallbacks: Set<() => void> = new Set();

  /**
   * delay by ms, careful when using on a loop if resolving on shutdown (default)
   */
  sleep(
    ms: number,
    reason: string,
    options?: { resolveOnShutdown?: boolean }
  ): Promise<void> {
    log.info(`Sleeper: sleeping for ${ms}ms. Reason: ${reason}`);
    const resolveOnShutdown = options?.resolveOnShutdown ?? true;

    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout | undefined;

      const shutdownCallback = () => {
        if (timeout) {
          clearTimeout(timeout);
        }
        log.info(
          `Sleeper: resolving sleep task on shutdown. Original reason: ${reason}`
        );
        if (resolveOnShutdown) {
          setTimeout(resolve, 0);
        } else {
          setTimeout(() => {
            reject(
              new Error(
                `Sleeper: rejecting sleep task during shutdown. Original reason: ${reason}`
              )
            );
          }, 0);
        }
      };

      if (this.#shuttingDown) {
        log.info(
          `Sleeper: sleep called when shutdown is in progress, scheduling immediate ${
            resolveOnShutdown ? 'resolution' : 'rejection'
          }. Original reason: ${reason}`
        );
        shutdownCallback();
        return;
      }

      timeout = setTimeout(() => {
        resolve();
        this.#removeShutdownCallback(shutdownCallback);
      }, ms);

      this.#addShutdownCallback(shutdownCallback);
    });
  }

  #addShutdownCallback(callback: () => void) {
    this.#shutdownCallbacks.add(callback);
  }

  #removeShutdownCallback(callback: () => void) {
    this.#shutdownCallbacks.delete(callback);
  }

  shutdown(): void {
    if (this.#shuttingDown) {
      return;
    }
    log.info(
      `Sleeper: shutting down, settling ${this.#shutdownCallbacks.size} in-progress sleep calls`
    );
    this.#shuttingDown = true;
    this.#shutdownCallbacks.forEach(cb => {
      try {
        cb();
      } catch (error) {
        log.error(
          'Sleeper: Error executing shutdown callback',
          Errors.toLogFormat(error)
        );
      }
    });
    log.info('Sleeper: sleep tasks settled');
  }
}

export const sleeper = new Sleeper();
