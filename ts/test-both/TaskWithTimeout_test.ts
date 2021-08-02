// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { sleep } from '../util/sleep';
import createTaskWithTimeout from '../textsecure/TaskWithTimeout';

describe('createTaskWithTimeout', () => {
  it('resolves when promise resolves', async () => {
    const task = () => Promise.resolve('hi!');
    const taskWithTimeout = createTaskWithTimeout(task, 'test');

    const result = await taskWithTimeout();
    assert.strictEqual(result, 'hi!');
  });

  it('flows error from promise back', async () => {
    const error = new Error('original');
    const task = () => Promise.reject(error);
    const taskWithTimeout = createTaskWithTimeout(task, 'test');

    await assert.isRejected(taskWithTimeout(), 'original');
  });

  it('rejects if promise takes too long (this one logs error to console)', async () => {
    const task = async () => {
      await sleep(3000);
    };
    const taskWithTimeout = createTaskWithTimeout(task, 'test', {
      timeout: 10,
    });

    await assert.isRejected(taskWithTimeout());
  });

  it('rejects if task throws (and does not log about taking too long)', async () => {
    const error = new Error('Task is throwing!');
    const task = () => {
      throw error;
    };
    const taskWithTimeout = createTaskWithTimeout(task, 'test', {
      timeout: 10,
    });
    await assert.isRejected(taskWithTimeout(), 'Task is throwing!');
  });

  it('passes arguments to the underlying function', async () => {
    const task = (arg: string) => Promise.resolve(arg);
    const taskWithTimeout = createTaskWithTimeout(task, 'test');

    const result = await taskWithTimeout('hi!');
    assert.strictEqual(result, 'hi!');
  });
});
