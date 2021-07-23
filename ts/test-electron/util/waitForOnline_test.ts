// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
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

  function getFakeWindow(): EventTarget {
    const result = new EventTarget();
    sinon.stub(result, 'addEventListener');
    sinon.stub(result, 'removeEventListener');
    return result;
  }

  it("resolves immediately if you're online", async () => {
    const fakeNavigator = { onLine: true };
    const fakeWindow = getFakeWindow();

    await waitForOnline(fakeNavigator, fakeWindow);

    sinon.assert.notCalled(fakeWindow.addEventListener as sinon.SinonStub);
    sinon.assert.notCalled(fakeWindow.removeEventListener as sinon.SinonStub);
  });

  it("if you're offline, resolves as soon as you're online (and cleans up listeners)", async () => {
    const fakeNavigator = { onLine: false };
    const fakeWindow = getFakeWindow();

    (fakeWindow.addEventListener as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 0);
      });

    let done = false;
    const promise = (async () => {
      await waitForOnline(fakeNavigator, fakeWindow);
      done = true;
    })();

    assert.isFalse(done);

    await promise;

    assert.isTrue(done);
    sinon.assert.calledOnce(fakeWindow.addEventListener as sinon.SinonStub);
    sinon.assert.calledOnce(fakeWindow.removeEventListener as sinon.SinonStub);
  });

  it("resolves immediately if you're online when passed a timeout", async () => {
    const fakeNavigator = { onLine: true };
    const fakeWindow = getFakeWindow();

    await waitForOnline(fakeNavigator, fakeWindow, { timeout: 1234 });

    sinon.assert.notCalled(fakeWindow.addEventListener as sinon.SinonStub);
    sinon.assert.notCalled(fakeWindow.removeEventListener as sinon.SinonStub);
  });

  it("resolves immediately if you're online even if passed a timeout of 0", async () => {
    const fakeNavigator = { onLine: true };
    const fakeWindow = getFakeWindow();

    await waitForOnline(fakeNavigator, fakeWindow, { timeout: 0 });

    sinon.assert.notCalled(fakeWindow.addEventListener as sinon.SinonStub);
    sinon.assert.notCalled(fakeWindow.removeEventListener as sinon.SinonStub);
  });

  it("if you're offline, resolves as soon as you're online if it happens before the timeout", async () => {
    const clock = sandbox.useFakeTimers();

    const fakeNavigator = { onLine: false };
    const fakeWindow = getFakeWindow();

    (fakeWindow.addEventListener as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 1000);
      });

    let done = false;
    (async () => {
      await waitForOnline(fakeNavigator, fakeWindow, { timeout: 9999 });
      done = true;
    })();

    await clock.tickAsync(600);
    assert.isFalse(done);

    await clock.tickAsync(500);

    assert.isTrue(done);
  });

  it('rejects if too much time has passed, and cleans up listeners', async () => {
    const clock = sandbox.useFakeTimers();

    const fakeNavigator = { onLine: false };
    const fakeWindow = getFakeWindow();

    (fakeWindow.addEventListener as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 9999);
      });

    const promise = waitForOnline(fakeNavigator, fakeWindow, {
      timeout: 100,
    });

    await clock.tickAsync(500);

    await assert.isRejected(promise);

    sinon.assert.calledOnce(fakeWindow.removeEventListener as sinon.SinonStub);
  });

  it('rejects if offline and passed a timeout of 0', async () => {
    const fakeNavigator = { onLine: false };
    const fakeWindow = getFakeWindow();

    (fakeWindow.addEventListener as sinon.SinonStub)
      .withArgs('online')
      .callsFake((_eventName: string, callback: () => void) => {
        setTimeout(callback, 9999);
      });

    const promise = waitForOnline(fakeNavigator, fakeWindow, { timeout: 0 });

    await assert.isRejected(promise);
  });
});
