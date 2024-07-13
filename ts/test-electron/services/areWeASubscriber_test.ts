// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { AreWeASubscriberService } from '../../services/areWeASubscriber';
import { explodePromise } from '../../util/explodePromise';

describe('"are we a subscriber?" service', () => {
  const subscriberId = new Uint8Array([1, 2, 3]);
  const fakeStorageDefaults = {
    onready: sinon.stub().callsArg(0),
    get: sinon.stub().withArgs('subscriberId').returns(subscriberId),
  };

  let sandbox: sinon.SinonSandbox;
  let service: AreWeASubscriberService;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    service = new AreWeASubscriberService();
  });

  it("stores false if there's no local subscriber ID", done => {
    const fakeServer = {
      getHasSubscription: sandbox.stub(),
      isOnline: () => true,
    };
    const fakeStorage = {
      ...fakeStorageDefaults,
      get: () => undefined,
      put: sandbox.stub().callsFake((key, value) => {
        assert.strictEqual(key, 'areWeASubscriber');
        assert.isFalse(value);
        done();
      }),
    };

    service.update(fakeStorage, fakeServer);
  });

  it("doesn't make a network request if there's no local subscriber ID", done => {
    const fakeServer = {
      getHasSubscription: sandbox.stub(),
      isOnline: () => true,
    };
    const fakeStorage = {
      ...fakeStorageDefaults,
      get: () => undefined,
      put: sandbox.stub().callsFake(() => {
        sinon.assert.notCalled(fakeServer.getHasSubscription);
        done();
      }),
    };

    service.update(fakeStorage, fakeServer);
  });

  it('requests the subscriber ID from the server', done => {
    const fakeServer = {
      getHasSubscription: sandbox.stub().resolves(false),
      isOnline: () => true,
    };
    const fakeStorage = {
      ...fakeStorageDefaults,
      put: sandbox
        .stub()
        .withArgs('areWeASubscriber')
        .callsFake(() => {
          sinon.assert.calledWithExactly(
            fakeServer.getHasSubscription,
            subscriberId
          );
          done();
        }),
    };

    service.update(fakeStorage, fakeServer);
  });

  it("stores when we're not a subscriber", done => {
    const fakeServer = {
      getHasSubscription: sandbox.stub().resolves(false),
      isOnline: () => true,
    };
    const fakeStorage = {
      ...fakeStorageDefaults,
      put: sandbox.stub().callsFake((key, value) => {
        assert.strictEqual(key, 'areWeASubscriber');
        assert.isFalse(value);
        done();
      }),
    };

    service.update(fakeStorage, fakeServer);
  });

  it("stores when we're a subscriber", done => {
    const fakeServer = {
      getHasSubscription: sandbox.stub().resolves(true),
      isOnline: () => true,
    };
    const fakeStorage = {
      ...fakeStorageDefaults,
      put: sandbox.stub().callsFake((key, value) => {
        assert.strictEqual(key, 'areWeASubscriber');
        assert.isTrue(value);
        done();
      }),
    };

    service.update(fakeStorage, fakeServer);
  });

  it('only runs one request at a time and enqueues one other', async () => {
    const allDone = explodePromise<void>();
    let putCallCount = 0;

    const fakeServer = {
      getHasSubscription: sandbox.stub().resolves(false),
      isOnline: () => true,
    };
    const fakeStorage = {
      ...fakeStorageDefaults,
      put: sandbox.stub().callsFake(() => {
        putCallCount += 1;
        if (putCallCount === 2) {
          allDone.resolve();
        } else if (putCallCount > 2) {
          throw new Error('Unexpected call to storage put');
        }
      }),
    };

    service.update(fakeStorage, fakeServer);
    service.update(fakeStorage, fakeServer);
    service.update(fakeStorage, fakeServer);
    service.update(fakeStorage, fakeServer);
    service.update(fakeStorage, fakeServer);

    await allDone.promise;

    sinon.assert.calledTwice(fakeServer.getHasSubscription);
    sinon.assert.calledTwice(fakeStorage.put);
  });
});
