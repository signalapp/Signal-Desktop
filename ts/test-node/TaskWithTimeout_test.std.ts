// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { sleep } from '../util/sleep.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import { MINUTE } from '../util/durations/index.std.js';
import {
  runTaskWithTimeout,
  suspendTasksWithTimeout,
  resumeTasksWithTimeout,
} from '../textsecure/TaskWithTimeout.std.js';

describe('runTaskWithTimeout', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('resolves when promise resolves', async () => {
    const task = () => Promise.resolve('hi!');
    const result = await runTaskWithTimeout(task, 'resolving-task');
    assert.strictEqual(result, 'hi!');
  });

  it('flows error from promise back', async () => {
    const error = new Error('original');
    const task = () => Promise.reject(error);
    const taskWithTimeout = runTaskWithTimeout(task, 'rejecting-task');

    await assert.isRejected(taskWithTimeout, 'original');
  });

  it('rejects if promise takes too long (this one logs error to console)', async () => {
    const clock = sandbox.useFakeTimers();

    const { promise: pause } = explodePromise<void>();

    // Never resolves
    const task = () => pause;
    const taskWithTimeout = runTaskWithTimeout(task, 'slow-task');

    const promise = assert.isRejected(taskWithTimeout);

    await clock.runAllAsync();

    await promise;
  });

  it('rejects if task throws (and does not log about taking too long)', async () => {
    const clock = sandbox.useFakeTimers();

    const error = new Error('Task is throwing!');
    const task = () => {
      throw error;
    };
    const taskWithTimeout = runTaskWithTimeout(task, 'throwing-task');
    await clock.runToLastAsync();
    await assert.isRejected(taskWithTimeout, 'Task is throwing!');
  });

  it('suspends and resumes tasks', async () => {
    const clock = sandbox.useFakeTimers();

    let state = 0;

    const task = async () => {
      state = 1;
      await sleep(2 * MINUTE - 100);
      state = 2;
      await sleep(2 * MINUTE - 100);
      state = 3;
    };
    const promise = runTaskWithTimeout(task, 'suspend-task', 'short-lived');

    assert.strictEqual(state, 1);

    suspendTasksWithTimeout();
    await clock.tickAsync(2 * MINUTE - 100);
    assert.strictEqual(state, 2);

    resumeTasksWithTimeout();
    await clock.tickAsync(2 * MINUTE - 100);
    assert.strictEqual(state, 3);

    await promise;
  });

  it('suspends and resumes timing out task', async () => {
    const clock = sandbox.useFakeTimers();

    const { promise: pause } = explodePromise<void>();

    // Never resolves
    const task = () => pause;
    const taskWithTimeout = runTaskWithTimeout(task, 'suspend-slow-task');

    const promise = assert.isRejected(taskWithTimeout);

    suspendTasksWithTimeout();

    await clock.runAllAsync();

    resumeTasksWithTimeout();

    await clock.runAllAsync();

    await promise;
  });
});
