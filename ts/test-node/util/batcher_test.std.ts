// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { createBatcher } from '../../util/batcher.std.js';
import { sleep } from '../../util/sleep.std.js';

describe('batcher', () => {
  it('should schedule a full batch', async () => {
    const processBatch = sinon.fake.resolves(undefined);

    const batcher = createBatcher<number>({
      name: 'test',
      wait: 10,
      maxSize: 2,
      processBatch,
    });

    batcher.add(1);
    batcher.add(2);

    assert.ok(processBatch.calledOnceWith([1, 2]), 'Full batch on first call');
  });

  it('should schedule a partial batch', async () => {
    const processBatch = sinon.fake.resolves(undefined);

    const batcher = createBatcher<number>({
      name: 'test',
      wait: 5,
      maxSize: 2,
      processBatch,
    });

    batcher.add(1);

    await sleep(10);

    assert.ok(processBatch.calledOnceWith([1]), 'Partial batch after timeout');
  });

  it('should remove scheduled items from a batch', async () => {
    const processBatch = sinon.fake.resolves(undefined);

    const batcher = createBatcher<number>({
      name: 'test',
      wait: 5,
      maxSize: 100,
      processBatch,
    });

    batcher.add(1);
    batcher.add(1);
    batcher.add(2);
    batcher.removeAll(1);

    await sleep(10);

    assert.ok(processBatch.calledOnceWith([2]), 'Remove all');
  });

  it('should flushAndWait a partial batch', async () => {
    const processBatch = sinon.fake.resolves(undefined);

    const batcher = createBatcher<number>({
      name: 'test',
      wait: 10000,
      maxSize: 1000,
      processBatch,
    });

    batcher.add(1);

    await batcher.flushAndWait();

    assert.ok(
      processBatch.calledOnceWith([1]),
      'Partial batch after flushAndWait'
    );
  });

  it('should flushAndWait a partial batch with new items added', async () => {
    let calledTimes = 0;
    const processBatch = async (batch: Array<number>): Promise<void> => {
      calledTimes += 1;
      if (calledTimes === 1) {
        assert.deepEqual(batch, [1], 'First partial batch');
        batcher.add(2);
      } else if (calledTimes === 2) {
        assert.deepEqual(batch, [2], 'Second partial batch');
      } else {
        assert.strictEqual(calledTimes, 2);
      }
    };

    const batcher = createBatcher<number>({
      name: 'test',
      wait: 10000,
      maxSize: 1000,
      processBatch,
    });

    batcher.add(1);

    await batcher.flushAndWait();

    assert.strictEqual(calledTimes, 2);
  });
});
