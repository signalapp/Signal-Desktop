/*
 * vim: ts=4:sw=4:expandtab
 */

'use strict';

describe("SignalProtocolStore", function() {
    before(function(done) {
        storage.put('registrationId', 1337);
        storage.put('identityKey', identityKey);
        storage.fetch().then(done, done);
    });
    var store = textsecure.storage.protocol;
    var identifier = '+5558675309';
    var identityKey = {
        pubKey: libsignal.crypto.getRandomBytes(33),
        privKey: libsignal.crypto.getRandomBytes(32),
    };
    var testKey = {
        pubKey: libsignal.crypto.getRandomBytes(33),
        privKey: libsignal.crypto.getRandomBytes(32),
    };
    describe('getLocalRegistrationId', function() {
        it('retrieves my registration id', function(done) {
            store.getLocalRegistrationId().then(function(reg) {
                assert.strictEqual(reg, 1337);
            }).then(done, done);
        });
    });
    describe('getIdentityKeyPair', function() {
        it('retrieves my identity key', function(done) {
            store.getIdentityKeyPair().then(function(key) {
                assertEqualArrayBuffers(key.pubKey, identityKey.pubKey);
                assertEqualArrayBuffers(key.privKey, identityKey.privKey);
            }).then(done,done);
        });
    });
    describe('saveIdentity', function() {
        it('stores identity keys', function(done) {
            store.saveIdentity(identifier, testKey.pubKey).then(function() {
                return store.loadIdentityKey(identifier).then(function(key) {
                    assertEqualArrayBuffers(key, testKey.pubKey);
                });
            }).then(done,done);
        });
        it('returns true on key change', function(done) {
            var newIdentity = libsignal.crypto.getRandomBytes(33);
            store.saveIdentity(identifier, testKey.pubKey).then(function() {
                store.saveIdentity(identifier, newIdentity).then(function(changed) {
                    assert.isTrue(changed);
                    done();
                });
            }).catch(done);
        });
    });
    describe('isTrustedIdentity', function() {
        it('returns true if a key is trusted', function(done) {
            store.saveIdentity(identifier, testKey.pubKey).then(function() {
                store.isTrustedIdentity(identifier, testKey.pubKey, store.Direction.RECEIVING).then(function(trusted) {
                    if (trusted) {
                        done();
                    } else {
                        done(new Error('Allowed to overwrite identity key'));
                    }
                }).catch(done);
            });
        });
        it('returns false if a key is untrusted', function(done) {
            var newIdentity = libsignal.crypto.getRandomBytes(33);
            store.saveIdentity(identifier, testKey.pubKey).then(function() {
                store.isTrustedIdentity(identifier, newIdentity, store.Direction.SENDING).then(function(trusted) {
                    if (trusted) {
                        done(new Error('Allowed to overwrite identity key'));
                    } else {
                        done();
                    }
                }).catch(done);
            });
        });
    });
    describe('storePreKey', function() {
        it('stores prekeys', function(done) {
            store.storePreKey(1, testKey).then(function() {
                return store.loadPreKey(1).then(function(key) {
                    assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
                    assertEqualArrayBuffers(key.privKey, testKey.privKey);
                });
            }).then(done,done);
        });
    });
    describe('removePreKey', function() {
        before(function(done) {
            store.storePreKey(2, testKey).then(done);
        });
        it('deletes prekeys', function(done) {
            store.removePreKey(2, testKey).then(function() {
                return store.loadPreKey(2).then(function(key) {
                    assert.isUndefined(key);
                });
            }).then(done,done);
        });
    });
    describe('storeSignedPreKey', function() {
        it('stores signed prekeys', function(done) {
            store.storeSignedPreKey(3, testKey).then(function() {
                return store.loadSignedPreKey(3).then(function(key) {
                    assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
                    assertEqualArrayBuffers(key.privKey, testKey.privKey);
                });
            }).then(done,done);
        });
    });
    describe('removeSignedPreKey', function() {
        before(function(done) {
            store.storeSignedPreKey(4, testKey).then(done);
        });
        it('deletes signed prekeys', function(done) {
            store.removeSignedPreKey(4, testKey).then(function() {
                return store.loadSignedPreKey(4).then(function(key) {
                    assert.isUndefined(key);
                });
            }).then(done,done);
        });
    });
    describe('storeSession', function() {
        it('stores sessions', function(done) {
            var testRecord = "an opaque string";
            store.storeSession(identifier + '.1', testRecord).then(function() {
                return store.loadSession(identifier + '.1').then(function(record) {
                    assert.deepEqual(record, testRecord);
                });
            }).then(done,done);
        });
    });
    describe('removeAllSessions', function() {
        it('removes all sessions for a number', function(done) {
            var testRecord = "an opaque string";
            var devices = [1, 2, 3].map(function(deviceId) {
                return [identifier, deviceId].join('.');
            });
            var promise = Promise.resolve();
            devices.forEach(function(encodedNumber) {
                promise = promise.then(function() {
                    return store.storeSession(encodedNumber, testRecord + encodedNumber);
                });
            });
            promise.then(function() {
                return store.removeAllSessions(identifier).then(function(record) {
                    return Promise.all(devices.map(store.loadSession.bind(store))).then(function(records) {
                        for (var i in records) {
                            assert.isUndefined(records[i]);
                        };
                    });
                });
            }).then(done,done);
        });
    });
    describe('clearSessionStore', function() {
        it ('clears the session store', function(done) {
            var testRecord = "an opaque string";
            store.storeSession(identifier + '.1', testRecord).then(function() {
                return store.clearSessionStore().then(function() {
                    return store.loadSession(identifier + '.1').then(function(record) {
                        assert.isUndefined(record);
                    });
                });
            }).then(done,done);

        });
    });
    describe('getDeviceIds', function() {
        it('returns deviceIds for a number', function(done) {
            var testRecord = "an opaque string";
            var devices = [1, 2, 3].map(function(deviceId) {
                return [identifier, deviceId].join('.');
            });
            var promise = Promise.resolve();
            devices.forEach(function(encodedNumber) {
                promise = promise.then(function() {
                    return store.storeSession(encodedNumber, testRecord + encodedNumber);
                });
            });
            promise.then(function() {
                return store.getDeviceIds(identifier).then(function(deviceIds) {
                    assert.sameMembers(deviceIds, [1, 2, 3]);
                });
            }).then(done,done);
        });
        it('returns empty array for a number with no device ids', function(done) {
            return store.getDeviceIds('foo').then(function(deviceIds) {
                assert.sameMembers(deviceIds,[]);
            }).then(done,done);
        });
    });
});
