// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import type {
  ExpiringEntity,
  ExpiringEntityCleanupService,
} from '../../../services/expiring/createExpiringEntityCleanupService.std.js';
import { createExpiringEntityCleanupService } from '../../../services/expiring/createExpiringEntityCleanupService.std.js';

function waitForMicrotasks() {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 1);
  });
}

function createMockClock() {
  type Callback = () => void;

  type Timeout = {
    scheduledTime: number;
    callback: Callback;
  };

  let currentTime = 0;
  let uniqueTimerId = 0;

  const timeouts = new Map<number, Timeout>();

  function getTimerId() {
    uniqueTimerId += 1;
    return uniqueTimerId;
  }

  return {
    getCurrentTime() {
      return currentTime;
    },
    async incrementCurrentTimeTo(expectedTime: number) {
      currentTime += 1;
      assert.equal(currentTime, expectedTime);
      for (const [id, timeout] of timeouts) {
        if (timeout.scheduledTime <= currentTime) {
          timeouts.delete(id);
          timeout.callback();
        }
      }
      await waitForMicrotasks();
    },
    setTimeout(callback: Callback, delayMs: number): number {
      const id = getTimerId();
      const scheduledTime = currentTime + delayMs;
      timeouts.set(id, { scheduledTime, callback });
      return id;
    },
    clearTimeout(id: number): void {
      timeouts.delete(id);
    },
    expectTimeouts(message: string, expectedTimes: ReadonlyArray<number>) {
      const actualTimes = Array.from(timeouts.values()).map(timeout => {
        return timeout.scheduledTime;
      });
      assert.deepEqual(actualTimes, expectedTimes, message);
    },
    reset() {
      currentTime = 0;
      timeouts.clear();
    },
  };
}

describe('createExpiringEntityCleanupService', () => {
  let serviceInstance: ExpiringEntityCleanupService | null = null;

  const clock = createMockClock();

  let mockExpiringEntities: Array<ExpiringEntity> = [];

  let calls: Array<string> = [];

  function expectCalls(msg: string, expected: ReadonlyArray<string>) {
    assert.deepEqual(calls, expected, msg);
    calls = [];
  }

  function addExpiringEntity(id: string, expiresAtMs: number) {
    mockExpiringEntities.push({ id, expiresAtMs });
  }

  function expectExpiringEntities(
    message: string,
    expectedIds: ReadonlyArray<string>
  ) {
    const actualIds = mockExpiringEntities.map(entity => entity.id);
    assert.deepEqual(actualIds, expectedIds, message);
  }

  function getService() {
    serviceInstance ??= createExpiringEntityCleanupService({
      logPrefix: 'test',
      async getNextExpiringEntity() {
        calls.push('getNextExpiringEntity');
        let result: ExpiringEntity | null = null;
        for (const entity of mockExpiringEntities) {
          if (result == null || entity.expiresAtMs <= result.expiresAtMs) {
            result = entity;
          }
        }
        return result;
      },
      async cleanupExpiredEntities() {
        calls.push('cleanupExpiredEntities');
        const deletedIds: Array<string> = [];
        const undeleted: Array<ExpiringEntity> = [];
        for (const entity of mockExpiringEntities) {
          if (entity.expiresAtMs <= clock.getCurrentTime()) {
            deletedIds.push(entity.id);
          } else {
            undeleted.push(entity);
          }
        }
        mockExpiringEntities = undeleted;
        return deletedIds;
      },
      subscribeToTriggers() {
        calls.push('subscribeToTriggers');
        return () => {
          calls.push('unsubscribeFromTriggers');
        };
      },
      _mockGetCurrentTime() {
        return clock.getCurrentTime();
      },
      _mockScheduleLongTimeout(ms, signal) {
        calls.push('_mockScheduleLongTimeout');
        return new Promise((resolve, reject) => {
          const timer = clock.setTimeout(resolve, ms);

          signal.addEventListener('abort', () => {
            clock.clearTimeout(timer);
            reject(signal.reason);
          });
        });
      },
    });

    return serviceInstance;
  }

  async function serviceStart(reason: string) {
    await getService().start(reason);
    await waitForMicrotasks();
  }

  async function serviceTrigger(reason: string) {
    await getService().trigger(reason);
    await waitForMicrotasks();
  }

  async function serviceStop(reason: string) {
    await getService().stop(reason);
    await waitForMicrotasks();
  }

  async function serviceStopImmediately(reason: string) {
    getService().stopImmediately(reason);
    await waitForMicrotasks();
  }

  afterEach(() => {
    clock.reset();
    serviceInstance?.stopImmediately('afterEach');
    serviceInstance = null;
    mockExpiringEntities = [];
  });

  it('should not call anything when triggered before start', async () => {
    expectCalls('init', []);
    await serviceTrigger('before start');
    expectCalls('triggering before start', []);
  });

  it('should startup correctly', async () => {
    addExpiringEntity('a', 1);
    addExpiringEntity('b', 2);
    addExpiringEntity('c', 3);
    addExpiringEntity('d', 4);

    // start will delete the first two
    await clock.incrementCurrentTimeTo(1);
    await clock.incrementCurrentTimeTo(2);

    await serviceStart('test start');
    expectCalls('after start', [
      'cleanupExpiredEntities',
      'subscribeToTriggers',
      'getNextExpiringEntity',
      '_mockScheduleLongTimeout',
    ]);
    expectExpiringEntities('after start', ['c', 'd']);
    clock.expectTimeouts('after start', [3]);

    // calling start twice shouldn't do anything new
    await serviceStart('test start when started');
    expectCalls('test start when started', []);

    // trigger first expiration
    await clock.incrementCurrentTimeTo(3);
    expectCalls('after expire c', [
      'cleanupExpiredEntities',
      'getNextExpiringEntity',
      '_mockScheduleLongTimeout',
    ]);
    expectExpiringEntities('after expire c', ['d']);
    clock.expectTimeouts('after expire c', [4]);

    // trigger second expiration
    await clock.incrementCurrentTimeTo(4);
    expectCalls('after expire d', [
      'cleanupExpiredEntities',
      'getNextExpiringEntity',
    ]);
    expectExpiringEntities('after expire d', []);
    clock.expectTimeouts('after expire d', []);

    // adding past entity
    addExpiringEntity('e', 1);
    await serviceTrigger('added e');
    expectCalls('after trigger e', [
      'cleanupExpiredEntities',
      'getNextExpiringEntity',
    ]);
    expectExpiringEntities('after first trigger', []);
    clock.expectTimeouts('after first trigger', []);

    // adding future entity
    addExpiringEntity('f', 5);
    await serviceTrigger('added f');
    expectCalls('after trigger f', [
      'cleanupExpiredEntities',
      'getNextExpiringEntity',
      '_mockScheduleLongTimeout',
    ]);
    expectExpiringEntities('after trigger f', ['f']);
    clock.expectTimeouts('after trigger f', [5]);

    // trigger future entity expiration
    await clock.incrementCurrentTimeTo(5);
    expectCalls('after expire f', [
      'cleanupExpiredEntities',
      'getNextExpiringEntity',
    ]);
    expectExpiringEntities('after expire f', []);
    clock.expectTimeouts('after expire f', []);

    // adding entity without triggering
    addExpiringEntity('g', 6);
    await clock.incrementCurrentTimeTo(6);

    // stopping service to check one last time
    await serviceStop('test stop');
    expectCalls('after stop', [
      'unsubscribeFromTriggers',
      'cleanupExpiredEntities',
    ]);
    expectExpiringEntities('after stop', []);
    clock.expectTimeouts('after stop', []);

    // calling stop twice shouldn't do anything new
    await serviceStop('test stop when stopped');
    expectCalls('test stop when stopped', []);

    // adding future entity after stopped
    addExpiringEntity('h', 7);
    await serviceTrigger('added h');
    expectCalls('added h after stop', []);
    expectExpiringEntities('added h after stop', ['h']);
    await clock.incrementCurrentTimeTo(7);

    // restarting
    await serviceStart('restarting');
    expectCalls('after restarting', [
      'cleanupExpiredEntities',
      'subscribeToTriggers',
      'getNextExpiringEntity',
    ]);
    expectExpiringEntities('removed h after restart', []);
    clock.expectTimeouts('removed h after restart', []);

    // adding future entity
    addExpiringEntity('i', 9);
    await serviceTrigger('added i');
    expectCalls('added i', [
      'cleanupExpiredEntities',
      'getNextExpiringEntity',
      '_mockScheduleLongTimeout',
    ]);
    expectExpiringEntities('added i', ['i']);
    clock.expectTimeouts('added i', [9]);

    await clock.incrementCurrentTimeTo(8);
    expectCalls('not yet expired i', []);
    expectExpiringEntities('not yet expired i', ['i']);
    clock.expectTimeouts('not yet expired i', [9]);

    await serviceStopImmediately('test stop immediately');
    expectCalls('test stop immediately', ['unsubscribeFromTriggers']);
    expectExpiringEntities('test stop immediately', ['i']);
    clock.expectTimeouts('test stop immediately', []);
  });
});
