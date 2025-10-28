// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import lodash from 'lodash';
import { sleep } from '../../util/sleep.std.js';

import { constantTimeEqual } from '../../Crypto.node.js';
import { OurProfileKeyService } from '../../services/ourProfileKey.std.js';

const { noop } = lodash;

describe('"our profile key" service', () => {
  const createFakeStorage = () => ({
    get: sinon.stub(),
    put: sinon.stub().resolves(),
    remove: sinon.stub().resolves(),
    onready: sinon.stub().callsArg(0),
  });

  describe('get', () => {
    it("fetches the key from storage if it's there", async () => {
      const fakeProfileKey = new Uint8Array(2);
      const fakeStorage = createFakeStorage();
      fakeStorage.get.withArgs('profileKey').returns(fakeProfileKey);

      const service = new OurProfileKeyService();
      service.initialize(fakeStorage);

      const profileKey = await service.get();
      assert.isTrue(
        profileKey && constantTimeEqual(profileKey, fakeProfileKey)
      );
    });

    it('resolves with undefined if the key is not in storage', async () => {
      const service = new OurProfileKeyService();
      service.initialize(createFakeStorage());

      assert.isUndefined(await service.get());
    });

    it("doesn't grab the profile key from storage until storage is ready", async () => {
      let onReadyCallback = noop;
      const fakeStorage = {
        ...createFakeStorage(),
        get: sinon.stub().returns(new Uint8Array(2)),
        onready: sinon.stub().callsFake(callback => {
          onReadyCallback = callback;
        }),
      };

      const service = new OurProfileKeyService();
      service.initialize(fakeStorage);

      const getPromise = service.get();

      // We want to make sure this isn't called even after a tick of the event loop.
      await sleep(1);
      sinon.assert.notCalled(fakeStorage.get);

      onReadyCallback();

      await getPromise;
      sinon.assert.calledOnce(fakeStorage.get);
    });

    it("doesn't grab the profile key until all blocking promises are ready", async () => {
      const fakeStorage = createFakeStorage();

      const service = new OurProfileKeyService();
      service.initialize(fakeStorage);

      let resolve1 = noop;
      service.blockGetWithPromise(
        new Promise<void>(resolve => {
          resolve1 = resolve;
        })
      );

      let reject2 = noop;
      service.blockGetWithPromise(
        new Promise<void>((_resolve, reject) => {
          reject2 = reject;
        })
      );

      let reject3 = noop;
      service.blockGetWithPromise(
        new Promise<void>((_resolve, reject) => {
          reject3 = reject;
        })
      );

      const getPromise = service.get();

      resolve1();
      await sleep(1);
      sinon.assert.notCalled(fakeStorage.get);

      reject2(new Error('uh oh'));
      await sleep(1);
      sinon.assert.notCalled(fakeStorage.get);

      reject3(new Error('oh no'));

      await getPromise;

      sinon.assert.calledOnce(fakeStorage.get);
    });

    it("if there are blocking promises, doesn't grab the profile key from storage more than once (in other words, subsequent calls piggyback)", async () => {
      const fakeStorage = createFakeStorage();
      fakeStorage.get.returns(new Uint8Array(2));

      const service = new OurProfileKeyService();
      service.initialize(fakeStorage);

      let resolve = noop;
      service.blockGetWithPromise(
        new Promise<void>(innerResolve => {
          resolve = innerResolve;
        })
      );

      const getPromises = [service.get(), service.get(), service.get()];
      resolve();
      const results = await Promise.all(getPromises);
      assert(new Set(results).size === 1, 'All results should be the same');

      sinon.assert.calledOnce(fakeStorage.get);
    });

    it('removes all of the blocking promises after waiting for them once', async () => {
      const fakeStorage = createFakeStorage();

      const service = new OurProfileKeyService();
      service.initialize(fakeStorage);

      let resolve = noop;
      service.blockGetWithPromise(
        new Promise<void>(innerResolve => {
          resolve = innerResolve;
        })
      );

      const getPromise = service.get();

      sinon.assert.notCalled(fakeStorage.get);
      resolve();
      await getPromise;
      sinon.assert.calledOnce(fakeStorage.get);

      await service.get();
      sinon.assert.calledTwice(fakeStorage.get);
    });
  });

  describe('set', () => {
    it('updates the key in storage', async () => {
      const fakeProfileKey = new Uint8Array(2);
      const fakeStorage = createFakeStorage();

      const service = new OurProfileKeyService();
      service.initialize(fakeStorage);
      await service.set(fakeProfileKey);

      sinon.assert.calledOnce(fakeStorage.put);
      sinon.assert.calledWith(fakeStorage.put, 'profileKey', fakeProfileKey);
    });

    it('clears the key in storage', async () => {
      const fakeStorage = createFakeStorage();

      const service = new OurProfileKeyService();
      service.initialize(fakeStorage);
      await service.set(undefined);

      sinon.assert.calledOnce(fakeStorage.remove);
      sinon.assert.calledWith(fakeStorage.remove, 'profileKey');
    });
  });
});
