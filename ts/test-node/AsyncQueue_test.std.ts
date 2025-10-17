// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { AsyncQueue } from '../util/AsyncQueue.std.js';

describe('AsyncQueue', () => {
  it('yields values as they are added, even if they were added before consuming', async () => {
    const queue = new AsyncQueue<number>();

    queue.add(1);
    queue.add(2);

    const resultPromise = (async () => {
      const results = [];
      for await (const value of queue) {
        results.push(value);
        if (value === 4) {
          break;
        }
      }
      return results;
    })();

    queue.add(3);
    queue.add(4);

    // Ignored, because we should've stopped iterating.
    queue.add(5);

    assert.deepEqual(await resultPromise, [1, 2, 3, 4]);
  });
});
