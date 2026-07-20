// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { CheckScheduler } from '../../util/CheckScheduler.preload.ts';
import { FIBONACCI_TIMEOUTS } from '../../util/BackOff.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';

describe('CheckScheduler', () => {
  const INTERVAL = 100_000;
  const NOW = 1_000_000;
  const STORAGE_KEY = 'backupCombinedCredentialsLastRequestTime';

  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;
  let stored: number | undefined;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers({ now: NOW });
    // Stub Math.random() to 0.5 so scheduling is deterministic (no jitter)
    sandbox.stub(Math, 'random').returns(0.5);

    stored = undefined;
    sandbox.stub(itemStorage, 'get').callsFake((key, defaultValue) => {
      if (key === STORAGE_KEY && stored !== undefined) {
        return stored;
      }
      return defaultValue;
    });
    sandbox.stub(itemStorage, 'put').callsFake(async (key, value) => {
      if (key === STORAGE_KEY && typeof value === 'number') {
        stored = value;
      }
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  function makeScheduler(
    callback: () => Promise<void>,
    callTimes?: Array<number>
  ): CheckScheduler {
    return new CheckScheduler({
      name: 'test',
      interval: INTERVAL,
      storageKey: STORAGE_KEY,
      callback: async () => {
        callTimes?.push(Date.now());
        await callback();
      },
    });
  }

  it('uses the rollout default (half an interval) when nothing is stored', async () => {
    const callTimes: Array<number> = [];
    makeScheduler(async () => undefined, callTimes).start();

    await clock.tickAsync(INTERVAL / 2 - 1);
    assert.deepEqual(callTimes, []);

    await clock.tickAsync(1);
    assert.deepEqual(callTimes, [NOW + INTERVAL / 2]);
  });

  it('runs immediately when the last check is already overdue', async () => {
    const callTimes: Array<number> = [];
    stored = NOW - 2 * INTERVAL;

    makeScheduler(async () => undefined, callTimes).start();
    await clock.tickAsync(0);

    assert.deepEqual(callTimes, [NOW]);
  });

  it('waits one interval after the last check before running', async () => {
    const callTimes: Array<number> = [];
    stored = NOW;

    makeScheduler(async () => undefined, callTimes).start();

    await clock.tickAsync(INTERVAL - 1);
    assert.deepEqual(callTimes, [], 'should not run before the interval');

    await clock.tickAsync(1);
    assert.deepEqual(callTimes, [NOW + INTERVAL]);
  });

  it('records the run time and reschedules after a successful check', async () => {
    const callTimes: Array<number> = [];
    stored = NOW - 2 * INTERVAL;

    makeScheduler(async () => undefined, callTimes).start();

    // Immediate first run persists `now` as the last-check time.
    await clock.tickAsync(0);
    assert.deepEqual(callTimes, [NOW]);
    assert.strictEqual(itemStorage.get(STORAGE_KEY), NOW);

    // Next run happens exactly one interval later.
    await clock.tickAsync(INTERVAL);
    assert.deepEqual(callTimes, [NOW, NOW + INTERVAL]);
    assert.strictEqual(itemStorage.get(STORAGE_KEY), NOW + INTERVAL);
  });

  it('does not overwrite the next-run time when the callback updates it', async () => {
    const callTimes: Array<number> = [];
    stored = NOW - 2 * INTERVAL;

    const scheduler = makeScheduler(async () => {
      // Callback pushes the next run far into the future itself.
      await itemStorage.put(STORAGE_KEY, NOW + 10 * INTERVAL);
    }, callTimes);
    scheduler.start();

    await clock.tickAsync(0);
    assert.deepEqual(callTimes, [NOW]);
    // The scheduler must respect the callback's write instead of stamping `now`.
    assert.strictEqual(itemStorage.get(STORAGE_KEY), NOW + 10 * INTERVAL);

    // And it should not fire again within a normal interval.
    await clock.tickAsync(INTERVAL);
    assert.deepEqual(callTimes, [NOW]);
  });

  it('throws if started twice', () => {
    const scheduler = makeScheduler(async () => undefined);
    scheduler.start();

    assert.throws(() => scheduler.start(), /already running/);
  });

  it('runAt schedules the next check at the requested time', async () => {
    const callTimes: Array<number> = [];
    stored = NOW;

    const scheduler = makeScheduler(async () => undefined, callTimes);
    scheduler.start();

    await scheduler.runAt(NOW + 5 * 1000);

    await clock.tickAsync(5 * 1000 - 1);
    assert.deepEqual(callTimes, []);

    await clock.tickAsync(1);
    assert.deepEqual(callTimes, [NOW + 5 * 1000]);
  });

  it('delayBy pushes the next check out by at least the given delay', async () => {
    const callTimes: Array<number> = [];
    stored = NOW;

    const scheduler = makeScheduler(async () => undefined, callTimes);
    scheduler.start();

    await scheduler.delayBy(3 * INTERVAL);

    await clock.tickAsync(3 * INTERVAL - 1);
    assert.deepEqual(callTimes, []);

    await clock.tickAsync(1);
    assert.deepEqual(callTimes, [NOW + 3 * INTERVAL]);
  });

  it('grows the retry interval on consecutive failures instead of pinning at the first backoff', async () => {
    const callTimes: Array<number> = [];
    stored = NOW - 2 * INTERVAL;

    makeScheduler(async () => {
      throw new Error('uhoh');
    }, callTimes).start();

    // Let the immediate first check run, then advance through several retries.
    // Sum of the first five fibonacci timeouts is 1+2+3+5+8 = 19s.
    await clock.tickAsync(0);
    await clock.tickAsync(20 * 1000);

    assert.isAtLeast(
      callTimes.length,
      6,
      'expected the immediate check plus at least five retries'
    );

    const gaps = callTimes
      .slice(1)
      // oxlint-disable-next-line typescript/no-non-null-assertion
      .map((time, index) => time - callTimes[index]!);

    assert.deepEqual(
      gaps.slice(0, 5),
      FIBONACCI_TIMEOUTS.slice(0, 5),
      `retry gaps should ramp up; got ${JSON.stringify(gaps)}`
    );
  });
});
