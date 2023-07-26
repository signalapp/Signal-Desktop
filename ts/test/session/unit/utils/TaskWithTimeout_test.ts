/* eslint-disable more/no-then */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { createTaskWithTimeout } from '../../../../session/utils/TaskWithTimeout';

chai.use(chaiAsPromised as any);
chai.should();

const { assert } = chai;

const taskName = 'whatever';

describe('createTaskWithTimeout', () => {
  it('resolves when promise resolves', async () => {
    const task = () => Promise.resolve('hi!');
    const taskWithTimeout = createTaskWithTimeout(task, 'task_123');

    await taskWithTimeout().then((result: any) => {
      assert.strictEqual(result, 'hi!');
    });
  });
  it('flows error from promise back', async () => {
    const error = new Error('original');
    const task = () => Promise.reject(error);
    const taskWithTimeout = createTaskWithTimeout(task, 'task_123');

    await taskWithTimeout().catch((flowedError: any) => {
      assert.strictEqual(error, flowedError);
    });
  });
  it('rejects if promise takes too long (this one logs error to console)', async () => {
    let complete = false;
    const task = async () =>
      new Promise(resolve => {
        setTimeout(() => {
          complete = true;
          resolve(null);
        }, 3000);
      });
    const taskWithTimeout = createTaskWithTimeout(task, taskName, 10);

    await taskWithTimeout().then(
      () => {
        throw new Error('it was not supposed to resolve!');
      },
      () => {
        assert.strictEqual(complete, false);
      }
    );
  });
  it('resolves if task returns something falsey', async () => {
    const task = () => {};
    const taskWithTimeout = createTaskWithTimeout(task, taskName);
    await taskWithTimeout();
  });
  it('resolves if task returns a non-promise', async () => {
    const task = () => 'hi!';
    const taskWithTimeout = createTaskWithTimeout(task, taskName);
    await taskWithTimeout().then((result: any) => {
      assert.strictEqual(result, 'hi!');
    });
  });
  it('rejects if task throws (and does not log about taking too long)', async () => {
    const error = new Error('Task is throwing!');
    const task = () => {
      throw error;
    };
    const taskWithTimeout = createTaskWithTimeout(task, taskName, 10);
    await taskWithTimeout().then(
      () => {
        throw new Error('Overall task should reject!');
      },
      (flowedError: any) => {
        assert.strictEqual(flowedError, error);
      }
    );
  });
});
