// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { InMemoryQueues } from '../../../jobs/helpers/InMemoryQueues.std.js';

describe('InMemoryQueues', () => {
  describe('get', () => {
    it('returns a new PQueue for each key', () => {
      const queues = new InMemoryQueues();

      assert.strictEqual(queues.get('a'), queues.get('a'));
      assert.notStrictEqual(queues.get('a'), queues.get('b'));
      assert.notStrictEqual(queues.get('b'), queues.get('c'));
    });

    it('returns a queue that only executes one thing at a time', () => {
      const queue = new InMemoryQueues().get('foo');

      assert.strictEqual(queue.concurrency, 1);
    });

    it('cleans up the queues when all tasks have run', async () => {
      const queues = new InMemoryQueues();

      const originalQueue = queues.get('foo');

      originalQueue.pause();
      const tasksPromise = originalQueue.addAll([
        async () => {
          assert.strictEqual(queues.get('foo'), originalQueue);
        },
        async () => {
          assert.strictEqual(queues.get('foo'), originalQueue);
        },
      ]);
      originalQueue.start();
      await tasksPromise;

      assert.notStrictEqual(queues.get('foo'), originalQueue);
    });
  });
});
