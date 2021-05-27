// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import * as sinon from 'sinon';

import { connectToServerWithStoredCredentials } from '../../util/connectToServerWithStoredCredentials';

describe('connectToServerWithStoredCredentials', () => {
  let fakeWebApi: any;
  let fakeStorage: { get: sinon.SinonStub };
  let fakeWebApiConnect: { connect: sinon.SinonStub };

  beforeEach(() => {
    fakeWebApi = {};
    fakeStorage = { get: sinon.stub() };
    fakeWebApiConnect = { connect: sinon.stub().returns(fakeWebApi) };
  });

  it('throws if no ID is in storage', () => {
    fakeStorage.get.withArgs('password').returns('swordfish');

    assert.throws(() => {
      connectToServerWithStoredCredentials(fakeWebApiConnect, fakeStorage);
    });
  });

  it('throws if the ID in storage is not a string', () => {
    fakeStorage.get.withArgs('uuid_id').returns(1234);
    fakeStorage.get.withArgs('password').returns('swordfish');

    assert.throws(() => {
      connectToServerWithStoredCredentials(fakeWebApiConnect, fakeStorage);
    });
  });

  it('throws if no password is in storage', () => {
    fakeStorage.get.withArgs('uuid_id').returns('foo');

    assert.throws(() => {
      connectToServerWithStoredCredentials(fakeWebApiConnect, fakeStorage);
    });
  });

  it('throws if the password in storage is not a string', () => {
    fakeStorage.get.withArgs('uuid_id').returns('foo');
    fakeStorage.get.withArgs('password').returns(1234);

    assert.throws(() => {
      connectToServerWithStoredCredentials(fakeWebApiConnect, fakeStorage);
    });
  });

  it('connects with the UUID ID (if available) and password', () => {
    fakeStorage.get.withArgs('uuid_id').returns('foo');
    fakeStorage.get.withArgs('number_id').returns('should not be used');
    fakeStorage.get.withArgs('password').returns('swordfish');

    connectToServerWithStoredCredentials(fakeWebApiConnect, fakeStorage);

    sinon.assert.calledWith(fakeWebApiConnect.connect, {
      username: 'foo',
      password: 'swordfish',
    });
  });

  it('connects with the number ID (if UUID ID not available) and password', () => {
    fakeStorage.get.withArgs('number_id').returns('bar');
    fakeStorage.get.withArgs('password').returns('swordfish');

    connectToServerWithStoredCredentials(fakeWebApiConnect, fakeStorage);

    sinon.assert.calledWith(fakeWebApiConnect.connect, {
      username: 'bar',
      password: 'swordfish',
    });
  });

  it('returns the connected WebAPI', () => {
    fakeStorage.get.withArgs('uuid_id').returns('foo');
    fakeStorage.get.withArgs('password').returns('swordfish');

    assert.strictEqual(
      connectToServerWithStoredCredentials(fakeWebApiConnect, fakeStorage),
      fakeWebApi
    );
  });
});
