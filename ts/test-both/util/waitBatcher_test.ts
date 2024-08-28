// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { createWaitBatcher } from '../../util/waitBatcher';
import { drop } from '../../util/drop';
import { sleep } from '../../util/sleep';

describe('waitBatcher', () => {
  let processBatch: sinon.SinonSpy;
  let processResults: Array<Array<number>>;

  beforeEach(() => {
    processResults = [];
    processBatch = sinon.fake(async (list: Array<number>) => {
      await sleep(1);
      processResults.push(list);
      return undefined;
    });
  });

  it('should schedule a full batch', async () => {
    const batcher = createWaitBatcher<number>({
      name: 'test',
      wait: 10,
      maxSize: 2,
      processBatch,
    });

    await Promise.all([batcher.add(1), batcher.add(2)]);

    assert.ok(processBatch.calledOnceWith([1, 2]), 'Full batch on first call');
    assert.deepEqual(processResults[0], [1, 2]);
  });

  it('should schedule a partial batch', async () => {
    const batcher = createWaitBatcher<number>({
      name: 'test',
      wait: 10,
      maxSize: 2,
      processBatch,
    });

    await batcher.add(1);

    assert.ok(processBatch.calledOnceWith([1]), 'Partial batch on timeout');
    assert.deepEqual(processResults[0], [1]);
  });

  it('should flush a partial batch', async () => {
    const batcher = createWaitBatcher<number>({
      name: 'test',
      wait: 10000,
      maxSize: 1000,
      processBatch,
    });

    await Promise.all([batcher.add(1), batcher.flushAndWait()]);

    assert.ok(
      processBatch.calledOnceWith([1]),
      'Partial batch on flushAndWait'
    );
    assert.deepEqual(processResults[0], [1]);
  });

  it('should flush a partial batch with new items added', async () => {
    const batcher = createWaitBatcher<number>({
      name: 'test',
      wait: 10000,
      maxSize: 1000,
      processBatch,
    });

    await Promise.all([
      (async () => {
        await batcher.add(1);
        await batcher.add(2);
      })(),
      batcher.flushAndWait(),
    ]);

    assert(processBatch.firstCall.calledWith([1]), 'First partial batch');
    assert.deepEqual(processResults[0], [1]);
    assert(processBatch.secondCall.calledWith([2]), 'Second partial batch');
    assert.deepEqual(processResults[1], [2]);
    assert(!processBatch.thirdCall);
  });

  it('#addNoopAndWait returns as soon as #2 is complete, but more have been added', async () => {
    const batcher = createWaitBatcher<number>({
      name: 'test',
      wait: 1000,
      maxSize: 1000,
      processBatch,
    });

    drop(batcher.add(1));
    drop(batcher.add(2));
    const waitPromise = batcher.pushNoopAndWait();
    drop(batcher.add(3));

    await waitPromise;

    assert(processBatch.firstCall.calledWith([1, 2]), 'First partial batch');
    assert.deepEqual(processResults[0], [1, 2]);

    // Typescript needs this; doesn't realize that secondCall could be set later
    const { secondCall } = processBatch;
    assert(!secondCall);

    await batcher.flushAndWait();

    assert(processBatch.secondCall.calledWith([3]), 'Second partial batch');
    assert.deepEqual(processResults[1], [3]);
  });
});
