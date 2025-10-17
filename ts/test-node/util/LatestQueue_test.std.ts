// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';

import { LatestQueue } from '../../util/LatestQueue.std.js';

describe('LatestQueue', () => {
  it('if the queue is empty, new tasks are started immediately', done => {
    new LatestQueue().add(async () => {
      done();
    });
  });

  it('only enqueues the latest operation', done => {
    const queue = new LatestQueue();

    const spy = sinon.spy();

    let openFirstTaskGate: undefined | (() => void);
    const firstTaskGate = new Promise<void>(resolve => {
      openFirstTaskGate = resolve;
    });
    if (!openFirstTaskGate) {
      throw new Error('Test is misconfigured; cannot grab inner resolve');
    }

    queue.add(async () => {
      await firstTaskGate;
      spy('first');
    });

    queue.add(async () => {
      spy('second');
    });

    queue.add(async () => {
      spy('third');
    });

    sinon.assert.notCalled(spy);

    openFirstTaskGate();

    queue.onceEmpty(() => {
      sinon.assert.calledTwice(spy);
      sinon.assert.calledWith(spy, 'first');
      sinon.assert.calledWith(spy, 'third');

      done();
    });
  });
});
