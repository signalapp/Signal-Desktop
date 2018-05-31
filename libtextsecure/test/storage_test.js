'use strict';

describe('SignalProtocolStore', function() {
  before(function() {
    localStorage.clear();
  });
  var store = textsecure.storage.protocol;
  var identifier = '+5558675309';
  var another_identifier = '+5555590210';
  var identityKey = {
    pubKey: libsignal.crypto.getRandomBytes(33),
    privKey: libsignal.crypto.getRandomBytes(32),
  };
  var testKey = {
    pubKey: libsignal.crypto.getRandomBytes(33),
    privKey: libsignal.crypto.getRandomBytes(32),
  };
  it('retrieves my registration id', function(done) {
    store.put('registrationId', 1337);
    store
      .getLocalRegistrationId()
      .then(function(reg) {
        assert.strictEqual(reg, 1337);
      })
      .then(done, done);
  });
  it('retrieves my identity key', function(done) {
    store.put('identityKey', identityKey);
    store
      .getIdentityKeyPair()
      .then(function(key) {
        assertEqualArrayBuffers(key.pubKey, identityKey.pubKey);
        assertEqualArrayBuffers(key.privKey, identityKey.privKey);
      })
      .then(done, done);
  });
  it('stores identity keys', function(done) {
    store
      .saveIdentity(identifier, testKey.pubKey)
      .then(function() {
        return store.loadIdentityKey(identifier).then(function(key) {
          assertEqualArrayBuffers(key, testKey.pubKey);
        });
      })
      .then(done, done);
  });
  it('returns whether a key is trusted', function(done) {
    var newIdentity = libsignal.crypto.getRandomBytes(33);
    store.saveIdentity(identifier, testKey.pubKey).then(function() {
      store
        .isTrustedIdentity(identifier, newIdentity)
        .then(function(trusted) {
          if (trusted) {
            done(new Error('Allowed to overwrite identity key'));
          } else {
            done();
          }
        })
        .catch(done);
    });
  });
  it('returns whether a key is untrusted', function(done) {
    var newIdentity = libsignal.crypto.getRandomBytes(33);
    store.saveIdentity(identifier, testKey.pubKey).then(function() {
      store
        .isTrustedIdentity(identifier, testKey.pubKey)
        .then(function(trusted) {
          if (trusted) {
            done();
          } else {
            done(new Error('Allowed to overwrite identity key'));
          }
        })
        .catch(done);
    });
  });
  it('stores prekeys', function(done) {
    store
      .storePreKey(1, testKey)
      .then(function() {
        return store.loadPreKey(1).then(function(key) {
          assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
          assertEqualArrayBuffers(key.privKey, testKey.privKey);
        });
      })
      .then(done, done);
  });
  it('deletes prekeys', function(done) {
    before(function(done) {
      store.storePreKey(2, testKey).then(done);
    });
    store
      .removePreKey(2, testKey)
      .then(function() {
        return store.loadPreKey(2).then(function(key) {
          assert.isUndefined(key);
        });
      })
      .then(done, done);
  });
  it('stores signed prekeys', function(done) {
    store
      .storeSignedPreKey(3, testKey)
      .then(function() {
        return store.loadSignedPreKey(3).then(function(key) {
          assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
          assertEqualArrayBuffers(key.privKey, testKey.privKey);
        });
      })
      .then(done, done);
  });
  it('deletes signed prekeys', function(done) {
    before(function(done) {
      store.storeSignedPreKey(4, testKey).then(done);
    });
    store
      .removeSignedPreKey(4, testKey)
      .then(function() {
        return store.loadSignedPreKey(4).then(function(key) {
          assert.isUndefined(key);
        });
      })
      .then(done, done);
  });
  it('stores sessions', function(done) {
    var testRecord = 'an opaque string';
    var devices = [1, 2, 3].map(function(deviceId) {
      return [identifier, deviceId].join('.');
    });
    var promise = Promise.resolve();
    devices.forEach(function(encodedNumber) {
      promise = promise.then(function() {
        return store.storeSession(encodedNumber, testRecord + encodedNumber);
      });
    });
    promise
      .then(function() {
        return Promise.all(devices.map(store.loadSession.bind(store))).then(
          function(records) {
            for (var i in records) {
              assert.strictEqual(records[i], testRecord + devices[i]);
            }
          }
        );
      })
      .then(done, done);
  });
  it('removes all sessions for a number', function(done) {
    var testRecord = 'an opaque string';
    var devices = [1, 2, 3].map(function(deviceId) {
      return [identifier, deviceId].join('.');
    });
    var promise = Promise.resolve();
    devices.forEach(function(encodedNumber) {
      promise = promise.then(function() {
        return store.storeSession(encodedNumber, testRecord + encodedNumber);
      });
    });
    promise
      .then(function() {
        return store.removeAllSessions(identifier).then(function(record) {
          return Promise.all(devices.map(store.loadSession.bind(store))).then(
            function(records) {
              for (var i in records) {
                assert.isUndefined(records[i]);
              }
            }
          );
        });
      })
      .then(done, done);
  });
  it('returns deviceIds for a number', function(done) {
    var testRecord = 'an opaque string';
    var devices = [1, 2, 3].map(function(deviceId) {
      return [identifier, deviceId].join('.');
    });
    var promise = Promise.resolve();
    devices.forEach(function(encodedNumber) {
      promise = promise.then(function() {
        return store.storeSession(encodedNumber, testRecord + encodedNumber);
      });
    });
    promise
      .then(function() {
        return store.getDeviceIds(identifier).then(function(deviceIds) {
          assert.sameMembers(deviceIds, [1, 2, 3]);
        });
      })
      .then(done, done);
  });
  it('returns empty array for a number with no device ids', function() {
    return store.getDeviceIds('foo').then(function(deviceIds) {
      assert.sameMembers(deviceIds, []);
    });
  });
});
