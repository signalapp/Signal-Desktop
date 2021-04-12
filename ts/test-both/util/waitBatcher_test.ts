// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { createWaitBatcher } from '../../util/waitBatcher';

describe('waitBatcher', () => {
  it('should schedule a full batch', async () => {
    const processBatch = sinon.fake.resolves(undefined);

    const batcher = createWaitBatcher<number>({
      name: 'test',
      wait: 10,
      maxSize: 2,
      processBatch,
    });

    await Promise.all([batcher.add(1), batcher.add(2)]);

    assert.ok(processBatch.calledOnceWith([1, 2]), 'Full batch on first call');
  });

  it('should schedule a partial batch', async () => {
    const processBatch = sinon.fake.resolves(undefined);

    const batcher = createWaitBatcher<number>({
      name: 'test',
      wait: 10,
      maxSize: 2,
      processBatch,
    });

    await batcher.add(1);

    assert.ok(processBatch.calledOnceWith([1]), 'Partial batch on timeout');
  });

  it('should flush a partial batch', async () => {
    const processBatch = sinon.fake.resolves(undefined);

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
  });

  it('should flush a partial batch with new items added', async () => {
    const processBatch = sinon.fake.resolves(undefined);

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
    assert(processBatch.secondCall.calledWith([2]), 'Second partial batch');
    assert(!processBatch.thirdCall);
  });
});
