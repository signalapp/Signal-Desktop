// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { TaskDeduplicator } from '../../util/TaskDeduplicator.std.js';
import { explodePromise } from '../../util/explodePromise.std.js';
import { drop } from '../../util/drop.std.js';

describe('TaskDeduplicator', () => {
  it('should run a task', async () => {
    const t = new TaskDeduplicator('test', () => Promise.resolve());
    await t.run();
  });

  it('should not run two tasks concurrently', async () => {
    let count = 0;
    const { promise, resolve } = explodePromise<void>();
    const t = new TaskDeduplicator('test', () => {
      count += 1;
      return promise;
    });

    const p1 = t.run();
    const p2 = t.run();
    assert.strictEqual(count, 1);

    resolve();
    await Promise.all([p1, p2]);

    assert.strictEqual(count, 1);
  });

  it('should abort a task', async () => {
    function hangUntilAbort(abortSignal: AbortSignal) {
      const { promise, reject } = explodePromise<void>();
      abortSignal.addEventListener('abort', () => {
        reject(new Error('Aborted'));
      });
      return promise;
    }

    const t = new TaskDeduplicator('test', hangUntilAbort);

    const controller = new AbortController();
    const p = assert.isRejected(t.run(controller.signal), 'Aborted');

    controller.abort();
    await p;
  });

  it('should not abort both tasks, if another one is running', async () => {
    const { promise, resolve, reject } = explodePromise<void>();

    function hangUntilAbort(abortSignal: AbortSignal) {
      abortSignal.addEventListener('abort', () => {
        reject(new Error('Aborted'));
      });
      return promise;
    }

    const t = new TaskDeduplicator('test', hangUntilAbort);

    const c1 = new AbortController();
    const p1 = assert.isRejected(t.run(c1.signal), 'Aborted');

    const c2 = new AbortController();
    const p2 = t.run(c2.signal);

    // Abort only the first call
    c1.abort();
    await p1;

    // Second call should resolve normally
    resolve();
    await p2;
  });

  it('should cleanup after aborting both tasks', async () => {
    let count = 0;
    const { promise, reject } = explodePromise<void>();

    function hangUntilAbort(abortSignal: AbortSignal) {
      count += 1;
      abortSignal.addEventListener('abort', () => {
        reject(new Error('Aborted'));
      });
      return promise;
    }

    const t = new TaskDeduplicator('test', hangUntilAbort);

    const controller = new AbortController();
    const p1 = assert.isRejected(t.run(controller.signal), 'Aborted');

    const p2 = assert.isRejected(t.run(controller.signal), 'Aborted');

    // Abort both calls
    controller.abort();
    await p1;
    await p2;
    assert.strictEqual(count, 1);

    drop(t.run());
    assert.strictEqual(count, 2);
  });
});
