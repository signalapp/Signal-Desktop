// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';

import { waitForOnline } from '../../util/waitForOnline';

describe('waitForOnline', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  function getFakeEmitter(): EventEmitter {
    const result = new EventEmitter();
    sinon.stub(result, 'on');
    sinon.stub(result, 'off');
    return result;
  }

  it("resolves immediately if you're online", async () => {
    const fakeServer = { isOnline: () => true };
    const fakeEvents = getFakeEmitter();

    await waitForOnline({ server: fakeServer, events: fakeEvents });

    sinon.assert.notCalled(fakeEvents.on as sinon.SinonStub);
    sinon.assert.notCalled(fakeEvents.off as sinon.SinonStub);
  });

  it("if you're offline, resolves as soon as you're online (and cleans up listeners)", async () => {
    const fakeServer = { isOnline: () => false };
    const fakeEvents = getFakeEmitter();

    (fakeEvents.on as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 0);
      });

    let done = false;
    const promise = (async () => {
      await waitForOnline({ server: fakeServer, events: fakeEvents });
      done = true;
    })();

    assert.isFalse(done);

    await promise;

    assert.isTrue(done);
    sinon.assert.calledOnce(fakeEvents.on as sinon.SinonStub);
    sinon.assert.calledOnce(fakeEvents.off as sinon.SinonStub);
  });

  it("resolves immediately if you're online when passed a timeout", async () => {
    const fakeServer = { isOnline: () => true };
    const fakeEvents = getFakeEmitter();

    await waitForOnline({
      server: fakeServer,
      events: fakeEvents,
      timeout: 1234,
    });

    sinon.assert.notCalled(fakeEvents.on as sinon.SinonStub);
    sinon.assert.notCalled(fakeEvents.off as sinon.SinonStub);
  });

  it("resolves immediately if you're online even if passed a timeout of 0", async () => {
    const fakeServer = { isOnline: () => true };
    const fakeEvents = getFakeEmitter();

    await waitForOnline({ server: fakeServer, events: fakeEvents, timeout: 0 });

    sinon.assert.notCalled(fakeEvents.on as sinon.SinonStub);
    sinon.assert.notCalled(fakeEvents.off as sinon.SinonStub);
  });

  it("if you're offline, resolves as soon as you're online if it happens before the timeout", async () => {
    const clock = sandbox.useFakeTimers();

    const fakeServer = { isOnline: () => false };
    const fakeEvents = getFakeEmitter();

    (fakeEvents.on as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 1000);
      });

    let done = false;
    void (async () => {
      await waitForOnline({
        server: fakeServer,
        events: fakeEvents,
        timeout: 9999,
      });
      done = true;
    })();

    await clock.tickAsync(600);
    assert.isFalse(done);

    await clock.tickAsync(500);

    assert.isTrue(done);
  });

  it('rejects if too much time has passed, and cleans up listeners', async () => {
    const clock = sandbox.useFakeTimers();

    const fakeServer = { isOnline: () => false };
    const fakeEvents = getFakeEmitter();

    (fakeEvents.on as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 9999);
      });

    const promise = waitForOnline({
      server: fakeServer,
      events: fakeEvents,
      timeout: 100,
    });

    await clock.tickAsync(500);

    await assert.isRejected(promise);

    sinon.assert.calledOnce(fakeEvents.off as sinon.SinonStub);
  });

  it('rejects if offline and passed a timeout of 0', async () => {
    const fakeServer = { isOnline: () => false };
    const fakeEvents = getFakeEmitter();

    (fakeEvents.on as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 9999);
      });

    const promise = waitForOnline({
      server: fakeServer,
      events: fakeEvents,
      timeout: 100,
    });

    await assert.isRejected(promise);
  });
});
