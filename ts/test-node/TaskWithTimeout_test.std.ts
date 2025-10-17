// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { sleep } from '../util/sleep.std.js';
import { explodePromise } from '../util/explodePromise.std.js';
import createTaskWithTimeout, {
  suspendTasksWithTimeout,
  resumeTasksWithTimeout,
} from '../textsecure/TaskWithTimeout.std.js';

describe('createTaskWithTimeout', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('resolves when promise resolves', async () => {
    const task = () => Promise.resolve('hi!');
    const taskWithTimeout = createTaskWithTimeout(task, 'resolving-task');

    const result = await taskWithTimeout();
    assert.strictEqual(result, 'hi!');
  });

  it('flows error from promise back', async () => {
    const error = new Error('original');
    const task = () => Promise.reject(error);
    const taskWithTimeout = createTaskWithTimeout(task, 'rejecting-task');

    await assert.isRejected(taskWithTimeout(), 'original');
  });

  it('rejects if promise takes too long (this one logs error to console)', async () => {
    const clock = sandbox.useFakeTimers();

    const { promise: pause } = explodePromise<void>();

    // Never resolves
    const task = () => pause;
    const taskWithTimeout = createTaskWithTimeout(task, 'slow-task');

    const promise = assert.isRejected(taskWithTimeout());

    await clock.runToLastAsync();

    await promise;
  });

  it('rejects if task throws (and does not log about taking too long)', async () => {
    const clock = sandbox.useFakeTimers();

    const error = new Error('Task is throwing!');
    const task = () => {
      throw error;
    };
    const taskWithTimeout = createTaskWithTimeout(task, 'throwing-task');
    await clock.runToLastAsync();
    await assert.isRejected(taskWithTimeout(), 'Task is throwing!');
  });

  it('passes arguments to the underlying function', async () => {
    const task = (arg: string) => Promise.resolve(arg);
    const taskWithTimeout = createTaskWithTimeout(task, 'arguments-task');

    const result = await taskWithTimeout('hi!');
    assert.strictEqual(result, 'hi!');
  });

  it('suspends and resumes tasks', async () => {
    const clock = sandbox.useFakeTimers();

    let state = 0;

    const task = async () => {
      state = 1;
      await sleep(900);
      state = 2;
      await sleep(900);
      state = 3;
    };
    const taskWithTimeout = createTaskWithTimeout(task, 'suspend-task', {
      timeout: 1000,
    });

    const promise = taskWithTimeout();

    assert.strictEqual(state, 1);

    suspendTasksWithTimeout();
    await clock.tickAsync(900);
    assert.strictEqual(state, 2);

    resumeTasksWithTimeout();
    await clock.tickAsync(900);
    assert.strictEqual(state, 3);

    await promise;
  });

  it('suspends and resumes timing out task', async () => {
    const clock = sandbox.useFakeTimers();

    const { promise: pause } = explodePromise<void>();

    // Never resolves
    const task = () => pause;
    const taskWithTimeout = createTaskWithTimeout(task, 'suspend-slow-task');

    const promise = assert.isRejected(taskWithTimeout());

    suspendTasksWithTimeout();

    await clock.runToLastAsync();

    resumeTasksWithTimeout();

    await clock.runToLastAsync();

    await promise;
  });
});
