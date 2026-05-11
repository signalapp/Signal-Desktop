// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import sinon from 'sinon';
import { _Timers as Timers } from '../../axo/timers.dom.tsx';

describe('Timers', () => {
  let sandbox: sinon.SinonSandbox;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clock = sandbox.useFakeTimers();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('add() fires the callback after the given delay', () => {
    const timers = new Timers();
    const cb1 = sinon.fake();
    const cb2 = sinon.fake();

    timers.add(100, cb1);
    timers.add(101, cb2);

    clock.tick(99);
    assert.ok(!cb1.called);

    clock.tick(1);
    assert.ok(cb1.called);

    assert.ok(!cb2.called);
    clock.tick(1);
    assert.ok(cb2.called);
  });

  it('add() returns a cancel function that prevents the callback', () => {
    const timers = new Timers();
    const cb1 = sinon.fake();
    const cb2 = sinon.fake();

    const cancel1 = timers.add(100, cb1);
    const cancel2 = timers.add(200, cb2);

    cancel1();

    clock.tick(200);
    assert.ok(!cb1.called);
    assert.ok(cb2.called);

    assert.doesNotThrow(() => cancel2());
  });

  it('cancelAll() cancels every still pending timer', () => {
    const timers = new Timers();
    const cb1 = sinon.fake();
    const cb2 = sinon.fake();
    const cb3 = sinon.fake();

    timers.add(100, cb1);
    timers.add(200, cb2);
    timers.add(300, cb3);

    clock.tick(100);
    timers.cancelAll();

    clock.tick(500);
    sinon.assert.called(cb1);
    sinon.assert.notCalled(cb2);
    sinon.assert.notCalled(cb3);
  });
});
