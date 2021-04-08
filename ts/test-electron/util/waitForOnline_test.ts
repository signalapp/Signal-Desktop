// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';

import { waitForOnline } from '../../util/waitForOnline';

describe('waitForOnline', () => {
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

  it("if you're offline, resolves as soon as you're online", async () => {
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
});
