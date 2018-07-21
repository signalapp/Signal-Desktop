describe('SignalProtocolStore', () => {
  before(() => {
    localStorage.clear();
  });
  const store = textsecure.storage.protocol;
  const identifier = '+5558675309';
  const another_identifier = '+5555590210';
  const identityKey = {
    pubKey: libsignal.crypto.getRandomBytes(33),
    privKey: libsignal.crypto.getRandomBytes(32),
  };
  const testKey = {
    pubKey: libsignal.crypto.getRandomBytes(33),
    privKey: libsignal.crypto.getRandomBytes(32),
  };
  it('retrieves my registration id', done => {
    store.put('registrationId', 1337);
    store
      .getLocalRegistrationId()
      .then(reg => {
        assert.strictEqual(reg, 1337);
      })
      .then(done, done);
  });
  it('retrieves my identity key', done => {
    store.put('identityKey', identityKey);
    store
      .getIdentityKeyPair()
      .then(key => {
        assertEqualArrayBuffers(key.pubKey, identityKey.pubKey);
        assertEqualArrayBuffers(key.privKey, identityKey.privKey);
      })
      .then(done, done);
  });
  it('stores identity keys', done => {
    store
      .saveIdentity(identifier, testKey.pubKey)
      .then(() =>
        store.loadIdentityKey(identifier).then(key => {
          assertEqualArrayBuffers(key, testKey.pubKey);
        })
      )
      .then(done, done);
  });
  it('returns whether a key is trusted', done => {
    const newIdentity = libsignal.crypto.getRandomBytes(33);
    store.saveIdentity(identifier, testKey.pubKey).then(() => {
      store
        .isTrustedIdentity(identifier, newIdentity)
        .then(trusted => {
          if (trusted) {
            done(new Error('Allowed to overwrite identity key'));
          } else {
            done();
          }
        })
        .catch(done);
    });
  });
  it('returns whether a key is untrusted', done => {
    const newIdentity = libsignal.crypto.getRandomBytes(33);
    store.saveIdentity(identifier, testKey.pubKey).then(() => {
      store
        .isTrustedIdentity(identifier, testKey.pubKey)
        .then(trusted => {
          if (trusted) {
            done();
          } else {
            done(new Error('Allowed to overwrite identity key'));
          }
        })
        .catch(done);
    });
  });
  it('stores prekeys', done => {
    store
      .storePreKey(1, testKey)
      .then(() =>
        store.loadPreKey(1).then(key => {
          assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
          assertEqualArrayBuffers(key.privKey, testKey.privKey);
        })
      )
      .then(done, done);
  });
  it('deletes prekeys', done => {
    before(done => {
      store.storePreKey(2, testKey).then(done);
    });
    store
      .removePreKey(2, testKey)
      .then(() =>
        store.loadPreKey(2).then(key => {
          assert.isUndefined(key);
        })
      )
      .then(done, done);
  });
  it('stores signed prekeys', done => {
    store
      .storeSignedPreKey(3, testKey)
      .then(() =>
        store.loadSignedPreKey(3).then(key => {
          assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
          assertEqualArrayBuffers(key.privKey, testKey.privKey);
        })
      )
      .then(done, done);
  });
  it('deletes signed prekeys', done => {
    before(done => {
      store.storeSignedPreKey(4, testKey).then(done);
    });
    store
      .removeSignedPreKey(4, testKey)
      .then(() =>
        store.loadSignedPreKey(4).then(key => {
          assert.isUndefined(key);
        })
      )
      .then(done, done);
  });
  it('stores sessions', done => {
    const testRecord = 'an opaque string';
    const devices = [1, 2, 3].map(deviceId => [identifier, deviceId].join('.'));
    let promise = Promise.resolve();
    devices.forEach(encodedNumber => {
      promise = promise.then(() =>
        store.storeSession(encodedNumber, testRecord + encodedNumber)
      );
    });
    promise
      .then(() =>
        Promise.all(devices.map(store.loadSession.bind(store))).then(
          records => {
            for (const i in records) {
              assert.strictEqual(records[i], testRecord + devices[i]);
            }
          }
        )
      )
      .then(done, done);
  });
  it('removes all sessions for a number', done => {
    const testRecord = 'an opaque string';
    const devices = [1, 2, 3].map(deviceId => [identifier, deviceId].join('.'));
    let promise = Promise.resolve();
    devices.forEach(encodedNumber => {
      promise = promise.then(() =>
        store.storeSession(encodedNumber, testRecord + encodedNumber)
      );
    });
    promise
      .then(() =>
        store.removeAllSessions(identifier).then(record =>
          Promise.all(devices.map(store.loadSession.bind(store))).then(
            records => {
              for (const i in records) {
                assert.isUndefined(records[i]);
              }
            }
          )
        )
      )
      .then(done, done);
  });
  it('returns deviceIds for a number', done => {
    const testRecord = 'an opaque string';
    const devices = [1, 2, 3].map(deviceId => [identifier, deviceId].join('.'));
    let promise = Promise.resolve();
    devices.forEach(encodedNumber => {
      promise = promise.then(() =>
        store.storeSession(encodedNumber, testRecord + encodedNumber)
      );
    });
    promise
      .then(() =>
        store.getDeviceIds(identifier).then(deviceIds => {
          assert.sameMembers(deviceIds, [1, 2, 3]);
        })
      )
      .then(done, done);
  });
  it('returns empty array for a number with no device ids', () =>
    store.getDeviceIds('foo').then(deviceIds => {
      assert.sameMembers(deviceIds, []);
    }));
});
