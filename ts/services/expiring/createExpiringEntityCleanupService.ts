// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { getEnvironment, isTestEnvironment } from '../../environment.std.js';
import { createLogger } from '../../logging/log.std.js';
import * as Errors from '../../types/errors.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { drop } from '../../util/drop.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { longTimeoutAsync } from '../../util/timeout.std.js';

const parentLog = createLogger('ExpiringEntityCleanupService');

export type ExpiringEntity = Readonly<{
  id: string;
  expiresAtMs: number;
}>;

export type Trigger = (reason: string) => void;
export type Unsubscribe = () => void;

export type ExpiringEntityCleanupServiceOptions = Readonly<{
  logPrefix: string;
  getNextExpiringEntity: () => Promise<ExpiringEntity | null>;
  cleanupExpiredEntities: () => Promise<ReadonlyArray<string>>;
  subscribeToTriggers: (trigger: Trigger) => Unsubscribe;
  _mockGetCurrentTime?: () => number;
  _mockScheduleLongTimeout?: (ms: number, signal: AbortSignal) => Promise<void>;
}>;

export type ExpiringEntityCleanupService = Readonly<{
  start: (reason: string) => Promise<void>;
  trigger: (reason: string) => Promise<void>;
  stop: (reason: string) => Promise<void>;
  stopImmediately: (reason: string) => void;
}>;

enum ServiceState {
  NEVER_STARTED,
  STARTED,
  STOPPED,
}

export function createExpiringEntityCleanupService(
  options: ExpiringEntityCleanupServiceOptions
): ExpiringEntityCleanupService {
  const log = parentLog.child(options.logPrefix);

  let controller: AbortController | null = null;
  let runningPromise: Promise<void> | null = null;

  function getCurrentTime(): number {
    if (
      options._mockGetCurrentTime != null &&
      isTestEnvironment(getEnvironment())
    ) {
      return options._mockGetCurrentTime();
    }
    return Date.now();
  }

  function scheduleLongTimeout(ms: number, signal: AbortSignal): Promise<void> {
    if (
      options._mockScheduleLongTimeout != null &&
      isTestEnvironment(getEnvironment())
    ) {
      return options._mockScheduleLongTimeout(ms, signal);
    }
    return longTimeoutAsync(ms, signal);
  }

  function cancelNextScheduledRun(reason: string) {
    if (controller != null) {
      log.warn(`cancel(${reason}) cancelling next scheduled run`);
      controller.abort(reason);
      controller = null;
    }
  }

  async function getNextExpiringEntity(): Promise<ExpiringEntity | null> {
    try {
      const result = await options.getNextExpiringEntity();
      if (result == null) {
        log.info('no expiring entity found');
      } else {
        log.info(
          `next expiring entity is ${result.id} at ${result.expiresAtMs}`
        );
      }
      return result;
    } catch (error) {
      log.error(
        'failed to get next expiring entity',
        Errors.toLogFormat(error)
      );
      return null;
    }
  }

  async function cleanupExpiredEntities(
    expectSomeDeletions: boolean
  ): Promise<void> {
    try {
      log.info('deleting expired entities');
      const deletedEntityIds = await options.cleanupExpiredEntities();
      // Runs that happen during
      const logFn =
        expectSomeDeletions && deletedEntityIds.length === 0
          ? log.warn
          : log.info;
      logFn(
        `deleted ${deletedEntityIds.length} entities:`,
        deletedEntityIds.join(', ')
      );
    } catch (error) {
      log.error('cleanupExpiredEntities errored', Errors.toLogFormat(error));
    }
  }

  async function runOnceImmediately(expectSomeDeletions: boolean) {
    // Don't start a new cleanup while one is running
    runningPromise ??= cleanupExpiredEntities(expectSomeDeletions);
    try {
      await runningPromise;
    } finally {
      runningPromise = null;
    }
  }

  async function scheduleNextRun(): Promise<boolean> {
    strictAssert(
      controller == null,
      'Cannot schedule next run until after previously scheduled run has fired'
    );
    const nextExpiringEntity = await getNextExpiringEntity();
    if (nextExpiringEntity == null) {
      return true; // something will have to call `trigger()` later
    }

    const nextExpirationTime = nextExpiringEntity.expiresAtMs;

    const currentTime = getCurrentTime();
    if (nextExpirationTime <= currentTime) {
      log.info('expiration time is in past, running immediately');
      await runOnceImmediately(true);
      return false;
    }

    const nextExpirationDelay = nextExpirationTime - currentTime;
    log.info(
      `scheduling next run for ${nextExpirationTime} in ${nextExpirationDelay}ms`
    );
    try {
      controller = new AbortController();
      await scheduleLongTimeout(nextExpirationDelay, controller.signal);
      log.info('scheduled timer fired, running');
    } catch (error: unknown) {
      log.warn(
        'scheduled timer was cancelled, not running',
        Errors.toLogFormat(error)
      );
      return true;
    } finally {
      controller = null;
    }

    await runOnceImmediately(true);
    return false;
  }

  async function scheduleRunsUntilDrained() {
    let shouldStop = false;
    while (!shouldStop) {
      // eslint-disable-next-line no-await-in-loop
      shouldStop = await scheduleNextRun();
    }
  }

  let unsubscribeCallback: Unsubscribe | null = null;

  function startSubscription() {
    try {
      unsubscribeCallback = options.subscribeToTriggers(trigger);
    } catch (error) {
      log.error('failed to subscribe', Errors.toLogFormat(error));
    }
  }

  function cleanupSubscription() {
    try {
      unsubscribeCallback?.();
    } catch (error) {
      log.error('failed to unsubscribe', Errors.toLogFormat(error));
    }
  }

  // public api

  let serviceState = ServiceState.NEVER_STARTED;

  async function trigger(reason: string) {
    if (serviceState === ServiceState.NEVER_STARTED) {
      log.warn(`trigger(${reason}) service not started, doing nothing`);
      return;
    }
    if (serviceState === ServiceState.STARTED) {
      log.info(`trigger(${reason}) running`);
    }
    if (serviceState === ServiceState.STOPPED) {
      log.warn(`trigger(${reason}) service stopped, doing nothing`);
      return;
    }
    cancelNextScheduledRun(reason);
    await runOnceImmediately(false); // wait for first run
    drop(scheduleRunsUntilDrained());
  }

  async function start(reason: string) {
    switch (serviceState) {
      case ServiceState.NEVER_STARTED:
        log.info(`start(${reason}) starting`);
        break;
      case ServiceState.STARTED:
        log.warn(`start(${reason}) already started, doing nothing`);
        return;
      case ServiceState.STOPPED:
        log.info(`start(${reason}) starting, previously stopped`);
        break;
      default:
        throw missingCaseError(serviceState);
    }
    serviceState = ServiceState.STARTED;
    await runOnceImmediately(false); // wait for first run
    startSubscription();

    drop(scheduleRunsUntilDrained());
  }

  function stopCleanup(reason: string) {
    switch (serviceState) {
      case ServiceState.NEVER_STARTED:
        log.info(`stop(${reason}) never started, doing nothing`);
        return;
      case ServiceState.STARTED:
        log.info(`stop(${reason}) stopping`);
        break;
      case ServiceState.STOPPED:
        log.warn(`stop(${reason}) already stopped, doing nothing`);
        return;
      default:
        throw missingCaseError(serviceState);
    }
    serviceState = ServiceState.STOPPED;
    cleanupSubscription();
    cancelNextScheduledRun(reason);
  }

  async function stop(reason: string) {
    const wasRunning = serviceState === ServiceState.STARTED;
    stopCleanup(reason);
    if (wasRunning) {
      await runOnceImmediately(false);
    }
  }

  function stopImmediately(reason: string) {
    const wasRunning = serviceState === ServiceState.STARTED;
    if (wasRunning) {
      stopCleanup(reason);
    }
  }

  return { start, trigger, stop, stopImmediately };
}
