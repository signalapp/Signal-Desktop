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



  var IdentityKeyRecord = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'identityKeys'
  });
  describe('saveIdentity', function() {
    var record = new IdentityKeyRecord({id: identifier});

    it('stores identity keys', function(done) {
      store.saveIdentity(identifier, testKey.pubKey).then(function() {
        return store.loadIdentityKey(identifier).then(function(key) {
          assertEqualArrayBuffers(key, testKey.pubKey);
        });
      }).then(done,done);
    });
    it('allows key changes', function(done) {
      var newIdentity = libsignal.crypto.getRandomBytes(33);
      store.saveIdentity(identifier, testKey.pubKey).then(function() {
        store.saveIdentity(identifier, newIdentity).then(function() {
          done();
        });
      }).catch(done);
    });

    describe('When there is no existing key (first use)', function() {
      before(function(done) {
        store.removeIdentityKey(identifier).then(function() {
          store.saveIdentity(identifier, testKey.pubKey).then(function() {
            record.fetch().then(function() { done(); });
          });
        });
      });
      it('marks the key firstUse', function() {
        assert(record.get('firstUse'));
      });
      it('sets the timestamp', function() {
        assert(record.get('timestamp'));
      });
      it('sets the verified status to DEFAULT', function() {
        assert.strictEqual(record.get('verified'), store.VerifiedStatus.DEFAULT);
      });
    });
    describe('When there is a different existing key (non first use)', function() {
      var newIdentity = libsignal.crypto.getRandomBytes(33);
      var oldTimestamp = Date.now();
      before(function(done) {
        record.save({
          publicKey           : testKey.pubKey,
          firstUse            : true,
          timestamp           : oldTimestamp,
          nonblockingApproval : false,
          verified            : store.VerifiedStatus.DEFAULT
        }).then(function() {
          store.saveIdentity(identifier, newIdentity).then(function() {
            record.fetch().then(function() { done(); });
          });
        });
      });
      it('marks the key not firstUse', function() {
        assert(!record.get('firstUse'));
      });
      it('updates the timestamp', function() {
        assert.notEqual(record.get('timestamp'), oldTimestamp);
      });

      describe('The previous verified status was DEFAULT', function() {
        before(function(done) {
          record.save({
            publicKey           : testKey.pubKey,
            firstUse            : true,
            timestamp           : oldTimestamp,
            nonblockingApproval : false,
            verified            : store.VerifiedStatus.DEFAULT
          }).then(function() {
            store.saveIdentity(identifier, newIdentity).then(function() {
              record.fetch().then(function() { done(); });
            });
          });
        });
        it('sets the new key to unverified', function() {
          assert.strictEqual(record.get('verified'), store.VerifiedStatus.DEFAULT);
        });
      });
      describe('The previous verified status was VERIFIED', function() {
        before(function(done) {
          record.save({
            publicKey           : testKey.pubKey,
            firstUse            : true,
            timestamp           : oldTimestamp,
            nonblockingApproval : false,
            verified            : store.VerifiedStatus.VERIFIED
          }).then(function() {
            store.saveIdentity(identifier, newIdentity).then(function() {
              record.fetch().then(function() { done(); });
            });
          });
        });
        it('sets the new key to unverified', function() {
          assert.strictEqual(record.get('verified'), store.VerifiedStatus.UNVERIFIED);
        });
      });
      describe('The previous verified status was UNVERIFIED', function() {
        before(function(done) {
          record.save({
            publicKey           : testKey.pubKey,
            firstUse            : true,
            timestamp           : oldTimestamp,
            nonblockingApproval : false,
            verified            : store.VerifiedStatus.UNVERIFIED
          }).then(function() {
            store.saveIdentity(identifier, newIdentity).then(function() {
              record.fetch().then(function() { done(); });
            });
          });
        });
        it('sets the new key to unverified', function() {
          assert.strictEqual(record.get('verified'), store.VerifiedStatus.UNVERIFIED);
        });
      });
    });
    describe('When the key has not changed', function() {
      var oldTimestamp = Date.now();
      before(function(done) {
        record.save({
          publicKey           : testKey.pubKey,
          timestamp           : oldTimestamp,
          nonblockingApproval : false,
          verified            : store.VerifiedStatus.DEFAULT
        }).then(function() { done(); });
      });
      describe('If it is marked firstUse', function() {
        before(function(done) {
          record.save({ firstUse: true }).then(function() { done(); });
        });
        it('nothing changes', function(done) {
          store.saveIdentity(identifier, testKey.pubKey, true).then(function() {
            record.fetch().then(function() {
              assert(!record.get('nonblockingApproval'));
              assert.strictEqual(record.get('timestamp'), oldTimestamp);
              done();
            });
          });
        });
      });
      describe('If it is not marked firstUse', function() {
        before(function(done) {
          record.save({ firstUse: false }).then(function() { done(); });
        });
        describe('If nonblocking approval is required', function() {
          it('sets non-blocking approval', function(done) {
            store.saveIdentity(identifier, testKey.pubKey, true).then(function() {
              record.fetch().then(function() {
                assert.strictEqual(record.get('nonblockingApproval'), true);
                assert.strictEqual(record.get('timestamp'), oldTimestamp);
                assert.strictEqual(record.get('firstUse'), false);
                done();
              });
            });
          });
        });
      });
    });
  });
  describe('saveIdentityWithAttributes', function() {
    var now = Date.now();
    var record = new IdentityKeyRecord({id: identifier});
    var validAttributes = {
      publicKey           : testKey.pubKey,
      firstUse            : true,
      timestamp           : now,
      verified            : store.VerifiedStatus.VERIFIED,
      nonblockingApproval : false
    };
    before(function(done) {
      store.removeIdentityKey(identifier).then(function() { done(); });
    });
    describe('with valid attributes', function() {
      before(function(done) {
        store.saveIdentityWithAttributes(identifier, validAttributes).then(function() {
          return new Promise(function(resolve) {
            record.fetch().then(resolve);
          });
        }).then(done, done);
      });

      it('publicKey is saved', function() {
          assertEqualArrayBuffers(record.get('publicKey'), testKey.pubKey);
      });
      it('firstUse is saved', function() {
          assert.strictEqual(record.get('firstUse'), true);
      });
      it('timestamp is saved', function() {
          assert.strictEqual(record.get('timestamp'), now);
      });
      it('verified is saved', function() {
          assert.strictEqual(record.get('verified'), store.VerifiedStatus.VERIFIED);
      });
      it('nonblockingApproval is saved', function() {
          assert.strictEqual(record.get('nonblockingApproval'), false);
      });
    });
    describe('with invalid attributes', function() {
      var attributes;
      beforeEach(function() {
        attributes = _.clone(validAttributes);
      });

      function testInvalidAttributes(done) {
        store.saveIdentityWithAttributes(identifier, attributes).then(function() {
          done(new Error("saveIdentityWithAttributes should have failed"));
        }, function() {
          done(); // good. we expect to fail with invalid attributes.
        });
      }

      it('rejects an invalid publicKey', function(done) {
        attributes.publicKey = 'a string';
        testInvalidAttributes(done);
      });
      it('rejects invalid firstUse', function(done) {
        attributes.firstUse = 0;
        testInvalidAttributes(done);
      });
      it('rejects invalid timestamp', function(done) {
        attributes.timestamp = NaN;
        testInvalidAttributes(done);
      });
      it('rejects invalid verified', function(done) {
        attributes.verified = null;
        testInvalidAttributes(done);
      });
      it('rejects invalid nonblockingApproval', function(done) {
        attributes.nonblockingApproval = 0;
        testInvalidAttributes(done);
      });
    });
  });
  describe('setApproval', function() {
    var record = new IdentityKeyRecord({id: identifier});
    function fetchRecord() {
      return new Promise(function(resolve) {
        record.fetch().then(resolve);
      });
    }
    it ('sets nonblockingApproval', function(done) {
      store.setApproval(identifier, true).then(fetchRecord).then(function() {
        assert.strictEqual(record.get('nonblockingApproval'), true);
      }).then(done, done);
    });
  });
  describe('setVerified', function() {
    var record = new IdentityKeyRecord({id: identifier});
    function fetchRecord() {
      return new Promise(function(resolve) {
        record.fetch().then(resolve);
      });
    }
    it ('updates the verified status', function(done) {
      store.setVerified(identifier, store.VerifiedStatus.UNVERIFIED).then(fetchRecord).then(function() {
        assert.strictEqual(record.get('verified'), store.VerifiedStatus.UNVERIFIED);
      }).then(done, done);
    });
  });
  describe('getVerified', function() {
    before(function(done) {
      store.setVerified(identifier, store.VerifiedStatus.VERIFIED).then(done, done);
    });
    it ('resolves to the verified status', function(done) {
      store.getVerified(identifier).then(function(result) {
        assert.strictEqual(result, store.VerifiedStatus.VERIFIED);
      }).then(done, done);
    });
  });
  describe('isTrustedIdentity', function() {
    describe('When invalid direction is given', function(done) {
      it('should fail', function(done) {
        store.isTrustedIdentity(identifier, testKey.pubKey).then(function() {
          done(new Error('isTrustedIdentity should have failed'));
        }).catch(function(e) {
          done();
        });
      });
    });
    describe('When direction is RECEIVING', function() {
      it('always returns true', function(done) {
        var newIdentity = libsignal.crypto.getRandomBytes(33);
        store.saveIdentity(identifier, testKey.pubKey).then(function() {
          store.isTrustedIdentity(identifier, newIdentity, store.Direction.RECEIVING).then(function(trusted) {
            if (trusted) {
              done();
            } else {
              done(new Error('isTrusted returned false when receiving'));
            }
          }).catch(done);
        });
      });
    });
    describe('When direction is SENDING', function() {
      describe('When there is no existing key (first use)', function() {
        before(function(done) {
          store.removeIdentityKey(identifier).then(function() {
            done();
          });
        });
        it('returns true', function(done) {
          var newIdentity = libsignal.crypto.getRandomBytes(33);
          store.isTrustedIdentity(identifier, newIdentity, store.Direction.SENDING).then(function(trusted) {
            if (trusted) {
              done();
            } else {
              done(new Error('isTrusted returned false on first use'));
            }
          }).catch(done);
        });
      });
      describe('When there is an existing key', function() {
        before(function(done) {
          store.saveIdentity(identifier, testKey.pubKey).then(function() {
            done();
          });
        });
        describe('When the existing key is different', function() {
          it('returns false', function(done) {
            var newIdentity = libsignal.crypto.getRandomBytes(33);
            store.isTrustedIdentity(identifier, newIdentity, store.Direction.SENDING).then(function(trusted) {
              if (trusted) {
                done(new Error('isTrusted returned true on untrusted key'));
              } else {
                done();
              }
            }).catch(done);
          });
        });
        describe('When the existing key matches the new key', function() {
          var newIdentity = libsignal.crypto.getRandomBytes(33);
          before(function(done) {
            store.saveIdentity(identifier, newIdentity).then(function() {
              done();
            });
          });
          it('returns false if blocking approval is required', function(done) {
            storage.put('safety-numbers-approval', true);
            store.isTrustedIdentity(identifier, newIdentity, store.Direction.SENDING).then(function(trusted) {
              if (trusted) {
                done(new Error('isTrusted returned true on untrusted key'));
              } else {
                done();
              }
            }).catch(done);
          });
          it('returns false if keys match but nonblocking approval is required', function(done) {
            storage.put('safety-numbers-approval', false);
            store.isTrustedIdentity(identifier, newIdentity, store.Direction.SENDING).then(function(trusted) {
              if (trusted) {
                done(new Error('isTrusted returned true on untrusted key'));
              } else {
                done();
              }
            }).catch(done);
          });
          it('returns true if neither blocking nor nonblocking approval is required', function(done) {
            storage.put('safety-numbers-approval', false);
            store.saveIdentity(identifier, newIdentity, true).then(function() {
              store.isTrustedIdentity(identifier, newIdentity, store.Direction.SENDING).then(function(trusted) {
                if (trusted) {
                  done();
                } else {
                  done(new Error('isTrusted returned false on an approved key'));
                }
              }).catch(done);
            });
          });
        });
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
