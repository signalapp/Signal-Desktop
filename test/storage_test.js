'use strict';

describe('SignalProtocolStore', function() {
  var identifier = '+5558675309';
  var store;
  var identityKey;
  var testKey;

  function wrapDeferred(deferred) {
    return new Promise(function(resolve, reject) {
      return deferred.then(resolve, reject);
    });
  }

  before(function(done) {
    store = textsecure.storage.protocol;
    identityKey = {
      pubKey: libsignal.crypto.getRandomBytes(33),
      privKey: libsignal.crypto.getRandomBytes(32),
    };
    testKey = {
      pubKey: libsignal.crypto.getRandomBytes(33),
      privKey: libsignal.crypto.getRandomBytes(32),
    };

    storage.put('registrationId', 1337);
    storage.put('identityKey', identityKey);
    storage.fetch().then(done, done);
  });

  describe('getLocalRegistrationId', function() {
    it('retrieves my registration id', function(done) {
      store
        .getLocalRegistrationId()
        .then(function(reg) {
          assert.strictEqual(reg, 1337);
        })
        .then(done, done);
    });
  });
  describe('getIdentityKeyPair', function() {
    it('retrieves my identity key', function(done) {
      store
        .getIdentityKeyPair()
        .then(function(key) {
          assertEqualArrayBuffers(key.pubKey, identityKey.pubKey);
          assertEqualArrayBuffers(key.privKey, identityKey.privKey);
        })
        .then(done, done);
    });
  });

  var IdentityKeyRecord = Backbone.Model.extend({
    database: Whisper.Database,
    storeName: 'identityKeys',
  });
  describe('saveIdentity', function() {
    var record = new IdentityKeyRecord({ id: identifier });
    var address = new libsignal.SignalProtocolAddress(identifier, 1);

    it('stores identity keys', function(done) {
      store
        .saveIdentity(address.toString(), testKey.pubKey)
        .then(function() {
          return store.loadIdentityKey(identifier).then(function(key) {
            assertEqualArrayBuffers(key, testKey.pubKey);
          });
        })
        .then(done, done);
    });
    it('allows key changes', function(done) {
      var newIdentity = libsignal.crypto.getRandomBytes(33);
      store
        .saveIdentity(address.toString(), testKey.pubKey)
        .then(function() {
          store.saveIdentity(address.toString(), newIdentity).then(function() {
            done();
          });
        })
        .catch(done);
    });

    describe('When there is no existing key (first use)', function() {
      before(function(done) {
        store.removeIdentityKey(identifier).then(function() {
          store
            .saveIdentity(address.toString(), testKey.pubKey)
            .then(function() {
              record.fetch().then(function() {
                done();
              });
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
        assert.strictEqual(
          record.get('verified'),
          store.VerifiedStatus.DEFAULT
        );
      });
    });
    describe('When there is a different existing key (non first use)', function() {
      var newIdentity = libsignal.crypto.getRandomBytes(33);
      var oldTimestamp = Date.now();
      before(function(done) {
        record
          .save({
            publicKey: testKey.pubKey,
            firstUse: true,
            timestamp: oldTimestamp,
            nonblockingApproval: false,
            verified: store.VerifiedStatus.DEFAULT,
          })
          .then(function() {
            store
              .saveIdentity(address.toString(), newIdentity)
              .then(function() {
                record.fetch().then(function() {
                  done();
                });
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
          record
            .save({
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: oldTimestamp,
              nonblockingApproval: false,
              verified: store.VerifiedStatus.DEFAULT,
            })
            .then(function() {
              store
                .saveIdentity(address.toString(), newIdentity)
                .then(function() {
                  record.fetch().then(function() {
                    done();
                  });
                });
            });
        });
        it('sets the new key to unverified', function() {
          assert.strictEqual(
            record.get('verified'),
            store.VerifiedStatus.DEFAULT
          );
        });
      });
      describe('The previous verified status was VERIFIED', function() {
        before(function(done) {
          record
            .save({
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: oldTimestamp,
              nonblockingApproval: false,
              verified: store.VerifiedStatus.VERIFIED,
            })
            .then(function() {
              store
                .saveIdentity(address.toString(), newIdentity)
                .then(function() {
                  record.fetch().then(function() {
                    done();
                  });
                });
            });
        });
        it('sets the new key to unverified', function() {
          assert.strictEqual(
            record.get('verified'),
            store.VerifiedStatus.UNVERIFIED
          );
        });
      });
      describe('The previous verified status was UNVERIFIED', function() {
        before(function(done) {
          record
            .save({
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: oldTimestamp,
              nonblockingApproval: false,
              verified: store.VerifiedStatus.UNVERIFIED,
            })
            .then(function() {
              store
                .saveIdentity(address.toString(), newIdentity)
                .then(function() {
                  record.fetch().then(function() {
                    done();
                  });
                });
            });
        });
        it('sets the new key to unverified', function() {
          assert.strictEqual(
            record.get('verified'),
            store.VerifiedStatus.UNVERIFIED
          );
        });
      });
    });
    describe('When the key has not changed', function() {
      var oldTimestamp = Date.now();
      before(function(done) {
        record
          .save({
            publicKey: testKey.pubKey,
            timestamp: oldTimestamp,
            nonblockingApproval: false,
            verified: store.VerifiedStatus.DEFAULT,
          })
          .then(function() {
            done();
          });
      });
      describe('If it is marked firstUse', function() {
        before(function(done) {
          record.save({ firstUse: true }).then(function() {
            done();
          });
        });
        it('nothing changes', function(done) {
          store
            .saveIdentity(address.toString(), testKey.pubKey, true)
            .then(function() {
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
          record.save({ firstUse: false }).then(function() {
            done();
          });
        });
        describe('If nonblocking approval is required', function() {
          var now;
          before(function(done) {
            now = Date.now();
            record.save({ timestamp: now }).then(function() {
              done();
            });
          });
          it('sets non-blocking approval', function(done) {
            store
              .saveIdentity(address.toString(), testKey.pubKey, true)
              .then(function() {
                record.fetch().then(function() {
                  assert.strictEqual(record.get('nonblockingApproval'), true);
                  assert.strictEqual(record.get('timestamp'), now);
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
    var now;
    var record;
    var validAttributes;

    before(function(done) {
      now = Date.now();
      record = new IdentityKeyRecord({ id: identifier });
      validAttributes = {
        publicKey: testKey.pubKey,
        firstUse: true,
        timestamp: now,
        verified: store.VerifiedStatus.VERIFIED,
        nonblockingApproval: false,
      };

      store.removeIdentityKey(identifier).then(function() {
        done();
      });
    });
    describe('with valid attributes', function() {
      before(function(done) {
        store
          .saveIdentityWithAttributes(identifier, validAttributes)
          .then(function() {
            return new Promise(function(resolve) {
              record.fetch().then(resolve);
            });
          })
          .then(done, done);
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
        assert.strictEqual(
          record.get('verified'),
          store.VerifiedStatus.VERIFIED
        );
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
        store.saveIdentityWithAttributes(identifier, attributes).then(
          function() {
            done(new Error('saveIdentityWithAttributes should have failed'));
          },
          function() {
            done(); // good. we expect to fail with invalid attributes.
          }
        );
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
    var record = new IdentityKeyRecord({ id: identifier });
    function fetchRecord() {
      return new Promise(function(resolve) {
        record.fetch().then(resolve);
      });
    }
    it('sets nonblockingApproval', function(done) {
      store
        .setApproval(identifier, true)
        .then(fetchRecord)
        .then(function() {
          assert.strictEqual(record.get('nonblockingApproval'), true);
        })
        .then(done, done);
    });
  });
  describe('setVerified', function() {
    var record;
    function saveRecordDefault() {
      record = new IdentityKeyRecord({
        id: identifier,
        publicKey: testKey.pubKey,
        firstUse: true,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        nonblockingApproval: false,
      });
      return new Promise(function(resolve, reject) {
        record.save().then(resolve, reject);
      });
    }
    function fetchRecord() {
      return new Promise(function(resolve, reject) {
        record.fetch().then(resolve, reject);
      });
    }
    describe('with no public key argument', function() {
      before(saveRecordDefault);
      it('updates the verified status', function() {
        return store
          .setVerified(identifier, store.VerifiedStatus.VERIFIED)
          .then(fetchRecord)
          .then(function() {
            assert.strictEqual(
              record.get('verified'),
              store.VerifiedStatus.VERIFIED
            );
            assertEqualArrayBuffers(record.get('publicKey'), testKey.pubKey);
          });
      });
    });
    describe('with the current public key', function() {
      before(saveRecordDefault);
      it('updates the verified status', function() {
        return store
          .setVerified(
            identifier,
            store.VerifiedStatus.VERIFIED,
            testKey.pubKey
          )
          .then(fetchRecord)
          .then(function() {
            assert.strictEqual(
              record.get('verified'),
              store.VerifiedStatus.VERIFIED
            );
            assertEqualArrayBuffers(record.get('publicKey'), testKey.pubKey);
          });
      });
    });
    describe('with a mismatching public key', function() {
      var newIdentity = libsignal.crypto.getRandomBytes(33);
      before(saveRecordDefault);
      it('does not change the record.', function() {
        return store
          .setVerified(identifier, store.VerifiedStatus.VERIFIED, newIdentity)
          .then(fetchRecord)
          .then(function() {
            assert.strictEqual(
              record.get('verified'),
              store.VerifiedStatus.DEFAULT
            );
            assertEqualArrayBuffers(record.get('publicKey'), testKey.pubKey);
          });
      });
    });
  });
  describe('processContactSyncVerificationState', function() {
    var record;
    var newIdentity = libsignal.crypto.getRandomBytes(33);
    var keychangeTriggered;

    function fetchRecord() {
      return wrapDeferred(record.fetch());
    }

    beforeEach(function() {
      keychangeTriggered = 0;
      store.bind('keychange', function() {
        keychangeTriggered++;
      });
    });
    afterEach(function() {
      store.unbind('keychange');
    });

    describe('when the new verified status is DEFAULT', function() {
      describe('when there is no existing record', function() {
        before(function() {
          record = new IdentityKeyRecord({ id: identifier });
          return wrapDeferred(record.destroy());
        });

        it('does nothing', function() {
          return store
            .processContactSyncVerificationState(
              identifier,
              store.VerifiedStatus.DEFAULT,
              newIdentity
            )
            .then(fetchRecord)
            .then(
              function() {
                // fetchRecord resolved so there is a record.
                // Bad.
                throw new Error(
                  'processContactSyncVerificationState should not save new records'
                );
              },
              function() {
                assert.strictEqual(keychangeTriggered, 0);
              }
            );
        });
      });
      describe('when the record exists', function() {
        describe('when the existing key is different', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('does not save the new identity (because this is a less secure state)', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.DEFAULT,
                newIdentity
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(
                  record.get('verified'),
                  store.VerifiedStatus.VERIFIED
                );
                assertEqualArrayBuffers(
                  record.get('publicKey'),
                  testKey.pubKey
                );
                assert.strictEqual(keychangeTriggered, 0);
              });
          });
        });
        describe('when the existing key is the same but VERIFIED', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('updates the verified status', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.DEFAULT,
                testKey.pubKey
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(
                  record.get('verified'),
                  store.VerifiedStatus.DEFAULT
                );
                assertEqualArrayBuffers(
                  record.get('publicKey'),
                  testKey.pubKey
                );
                assert.strictEqual(keychangeTriggered, 0);
              });
          });
        });
        describe('when the existing key is the same and already DEFAULT', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.DEFAULT,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('does not hang', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.DEFAULT,
                testKey.pubKey
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(keychangeTriggered, 0);
              });
          });
        });
      });
    });
    describe('when the new verified status is UNVERIFIED', function() {
      describe('when there is no existing record', function() {
        before(function() {
          record = new IdentityKeyRecord({ id: identifier });
          return wrapDeferred(record.destroy());
        });

        it('saves the new identity and marks it verified', function() {
          return store
            .processContactSyncVerificationState(
              identifier,
              store.VerifiedStatus.UNVERIFIED,
              newIdentity
            )
            .then(fetchRecord)
            .then(function() {
              assert.strictEqual(
                record.get('verified'),
                store.VerifiedStatus.UNVERIFIED
              );
              assertEqualArrayBuffers(record.get('publicKey'), newIdentity);
              assert.strictEqual(keychangeTriggered, 0);
            });
        });
      });
      describe('when the record exists', function() {
        describe('when the existing key is different', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('saves the new identity and marks it UNVERIFIED', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.UNVERIFIED,
                newIdentity
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(
                  record.get('verified'),
                  store.VerifiedStatus.UNVERIFIED
                );
                assertEqualArrayBuffers(record.get('publicKey'), newIdentity);
                assert.strictEqual(keychangeTriggered, 1);
              });
          });
        });
        describe('when the key exists and is DEFAULT', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.DEFAULT,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('updates the verified status', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.UNVERIFIED,
                testKey.pubKey
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(
                  record.get('verified'),
                  store.VerifiedStatus.UNVERIFIED
                );
                assertEqualArrayBuffers(
                  record.get('publicKey'),
                  testKey.pubKey
                );
                assert.strictEqual(keychangeTriggered, 0);
              });
          });
        });
        describe('when the key exists and is already UNVERIFIED', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.UNVERIFIED,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('does not hang', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.UNVERIFIED,
                testKey.pubKey
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(keychangeTriggered, 0);
              });
          });
        });
      });
    });
    describe('when the new verified status is VERIFIED', function() {
      describe('when there is no existing record', function() {
        before(function() {
          record = new IdentityKeyRecord({ id: identifier });
          return new Promise(function(resolve, reject) {
            record.destroy().then(resolve, reject);
          });
        });

        it('saves the new identity and marks it verified', function() {
          return store
            .processContactSyncVerificationState(
              identifier,
              store.VerifiedStatus.VERIFIED,
              newIdentity
            )
            .then(fetchRecord)
            .then(function() {
              assert.strictEqual(
                record.get('verified'),
                store.VerifiedStatus.VERIFIED
              );
              assertEqualArrayBuffers(record.get('publicKey'), newIdentity);
              assert.strictEqual(keychangeTriggered, 0);
            });
        });
      });
      describe('when the record exists', function() {
        describe('when the existing key is different', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('saves the new identity and marks it VERIFIED', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.VERIFIED,
                newIdentity
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(
                  record.get('verified'),
                  store.VerifiedStatus.VERIFIED
                );
                assertEqualArrayBuffers(record.get('publicKey'), newIdentity);
                assert.strictEqual(keychangeTriggered, 1);
              });
          });
        });
        describe('when the existing key is the same but UNVERIFIED', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.UNVERIFIED,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('saves the identity and marks it verified', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.VERIFIED,
                testKey.pubKey
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(
                  record.get('verified'),
                  store.VerifiedStatus.VERIFIED
                );
                assertEqualArrayBuffers(
                  record.get('publicKey'),
                  testKey.pubKey
                );
                assert.strictEqual(keychangeTriggered, 0);
              });
          });
        });
        describe('when the existing key is the same and already VERIFIED', function() {
          before(function() {
            record = new IdentityKeyRecord({
              id: identifier,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
            return wrapDeferred(record.save());
          });

          it('does not hang', function() {
            return store
              .processContactSyncVerificationState(
                identifier,
                store.VerifiedStatus.VERIFIED,
                testKey.pubKey
              )
              .then(fetchRecord)
              .then(function() {
                assert.strictEqual(keychangeTriggered, 0);
              });
          });
        });
      });
    });
  });

  describe('isUntrusted', function() {
    it('returns false if identity key old enough', function() {
      var record = new IdentityKeyRecord({
        id: identifier,
        publicKey: testKey.pubKey,
        timestamp: Date.now() - 10 * 1000 * 60,
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: false,
      });
      return wrapDeferred(record.save())
        .then(function() {
          return store.isUntrusted(identifier);
        })
        .then(function(untrusted) {
          assert.strictEqual(untrusted, false);
        });
    });

    it('returns false if new but nonblockingApproval is true', function() {
      var record = new IdentityKeyRecord({
        id: identifier,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: true,
      });
      return wrapDeferred(record.save())
        .then(function() {
          return store.isUntrusted(identifier);
        })
        .then(function(untrusted) {
          assert.strictEqual(untrusted, false);
        });
    });

    it('returns false if new but firstUse is true', function() {
      var record = new IdentityKeyRecord({
        id: identifier,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: true,
        nonblockingApproval: false,
      });
      return wrapDeferred(record.save())
        .then(function() {
          return store.isUntrusted(identifier);
        })
        .then(function(untrusted) {
          assert.strictEqual(untrusted, false);
        });
    });

    it('returns true if new, and no flags are set', function() {
      var record = new IdentityKeyRecord({
        id: identifier,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: false,
      });
      return wrapDeferred(record.save())
        .then(function() {
          return store.isUntrusted(identifier);
        })
        .then(function(untrusted) {
          assert.strictEqual(untrusted, true);
        });
    });
  });

  describe('getVerified', function() {
    before(function(done) {
      store
        .setVerified(identifier, store.VerifiedStatus.VERIFIED)
        .then(done, done);
    });
    it('resolves to the verified status', function(done) {
      store
        .getVerified(identifier)
        .then(function(result) {
          assert.strictEqual(result, store.VerifiedStatus.VERIFIED);
        })
        .then(done, done);
    });
  });
  describe('isTrustedIdentity', function() {
    var address = new libsignal.SignalProtocolAddress(identifier, 1);
    describe('When invalid direction is given', function(done) {
      it('should fail', function(done) {
        store
          .isTrustedIdentity(identifier, testKey.pubKey)
          .then(function() {
            done(new Error('isTrustedIdentity should have failed'));
          })
          .catch(function(e) {
            done();
          });
      });
    });
    describe('When direction is RECEIVING', function() {
      it('always returns true', function(done) {
        var newIdentity = libsignal.crypto.getRandomBytes(33);
        store.saveIdentity(address.toString(), testKey.pubKey).then(function() {
          store
            .isTrustedIdentity(
              identifier,
              newIdentity,
              store.Direction.RECEIVING
            )
            .then(function(trusted) {
              if (trusted) {
                done();
              } else {
                done(new Error('isTrusted returned false when receiving'));
              }
            })
            .catch(done);
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
          store
            .isTrustedIdentity(identifier, newIdentity, store.Direction.SENDING)
            .then(function(trusted) {
              if (trusted) {
                done();
              } else {
                done(new Error('isTrusted returned false on first use'));
              }
            })
            .catch(done);
        });
      });
      describe('When there is an existing key', function() {
        before(function(done) {
          store
            .saveIdentity(address.toString(), testKey.pubKey)
            .then(function() {
              done();
            });
        });
        describe('When the existing key is different', function() {
          it('returns false', function(done) {
            var newIdentity = libsignal.crypto.getRandomBytes(33);
            store
              .isTrustedIdentity(
                identifier,
                newIdentity,
                store.Direction.SENDING
              )
              .then(function(trusted) {
                if (trusted) {
                  done(new Error('isTrusted returned true on untrusted key'));
                } else {
                  done();
                }
              })
              .catch(done);
          });
        });
        describe('When the existing key matches the new key', function() {
          var newIdentity = libsignal.crypto.getRandomBytes(33);
          before(function(done) {
            store
              .saveIdentity(address.toString(), newIdentity)
              .then(function() {
                done();
              });
          });
          it('returns false if keys match but we just received this new identiy', function(done) {
            store
              .isTrustedIdentity(
                identifier,
                newIdentity,
                store.Direction.SENDING
              )
              .then(function(trusted) {
                if (trusted) {
                  done(new Error('isTrusted returned true on untrusted key'));
                } else {
                  done();
                }
              })
              .catch(done);
          });
          it('returns true if we have already approved identity', function(done) {
            store
              .saveIdentity(address.toString(), newIdentity, true)
              .then(function() {
                store
                  .isTrustedIdentity(
                    identifier,
                    newIdentity,
                    store.Direction.SENDING
                  )
                  .then(function(trusted) {
                    if (trusted) {
                      done();
                    } else {
                      done(
                        new Error('isTrusted returned false on an approved key')
                      );
                    }
                  })
                  .catch(done);
              });
          });
        });
      });
    });
  });
  describe('storePreKey', function() {
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
  });
  describe('removePreKey', function() {
    before(function(done) {
      store.storePreKey(2, testKey).then(done);
    });
    it('deletes prekeys', function(done) {
      store
        .removePreKey(2, testKey)
        .then(function() {
          return store.loadPreKey(2).then(function(key) {
            assert.isUndefined(key);
          });
        })
        .then(done, done);
    });
  });
  describe('storeSignedPreKey', function() {
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
  });
  describe('removeSignedPreKey', function() {
    before(function(done) {
      store.storeSignedPreKey(4, testKey).then(done);
    });
    it('deletes signed prekeys', function(done) {
      store
        .removeSignedPreKey(4, testKey)
        .then(function() {
          return store.loadSignedPreKey(4).then(function(key) {
            assert.isUndefined(key);
          });
        })
        .then(done, done);
    });
  });
  describe('storeSession', function() {
    it('stores sessions', function(done) {
      var testRecord = 'an opaque string';
      store
        .storeSession(identifier + '.1', testRecord)
        .then(function() {
          return store.loadSession(identifier + '.1').then(function(record) {
            assert.deepEqual(record, testRecord);
          });
        })
        .then(done, done);
    });
  });
  describe('removeAllSessions', function() {
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
  });
  describe('clearSessionStore', function() {
    it('clears the session store', function(done) {
      var testRecord = 'an opaque string';
      store
        .storeSession(identifier + '.1', testRecord)
        .then(function() {
          return store.clearSessionStore().then(function() {
            return store.loadSession(identifier + '.1').then(function(record) {
              assert.isUndefined(record);
            });
          });
        })
        .then(done, done);
    });
  });
  describe('getDeviceIds', function() {
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
    it('returns empty array for a number with no device ids', function(done) {
      return store
        .getDeviceIds('foo')
        .then(function(deviceIds) {
          assert.sameMembers(deviceIds, []);
        })
        .then(done, done);
    });
  });

  describe('Not yet processed messages', function() {
    beforeEach(function() {
      return store
        .getAllUnprocessed()
        .then(function(items) {
          return Promise.all(
            _.map(items, function(item) {
              return store.removeUnprocessed(item.id);
            })
          );
        })
        .then(function() {
          return store.getAllUnprocessed();
        })
        .then(function(items) {
          assert.strictEqual(items.length, 0);
        });
    });

    it('adds two and gets them back', function() {
      return Promise.all([
        store.addUnprocessed({ id: 2, name: 'second', timestamp: 2 }),
        store.addUnprocessed({ id: 3, name: 'third', timestamp: 3 }),
        store.addUnprocessed({ id: 1, name: 'first', timestamp: 1 }),
      ])
        .then(function() {
          return store.getAllUnprocessed();
        })
        .then(function(items) {
          assert.strictEqual(items.length, 3);

          // they are in the proper order because the collection comparator is 'timestamp'
          assert.strictEqual(items[0].name, 'first');
          assert.strictEqual(items[1].name, 'second');
          assert.strictEqual(items[2].name, 'third');
        });
    });

    it('updateUnprocessed successfully updates only part of itme', function() {
      var id = 1;
      return store
        .addUnprocessed({ id: id, name: 'first', timestamp: 1 })
        .then(function() {
          return store.updateUnprocessed(id, { name: 'updated' });
        })
        .then(function() {
          return store.getAllUnprocessed();
        })
        .then(function(items) {
          assert.strictEqual(items.length, 1);
          assert.strictEqual(items[0].name, 'updated');
          assert.strictEqual(items[0].timestamp, 1);
        });
    });

    it('removeUnprocessed successfully deletes item', function() {
      var id = 1;
      return store
        .addUnprocessed({ id: id, name: 'first', timestamp: 1 })
        .then(function() {
          return store.removeUnprocessed(id);
        })
        .then(function() {
          return store.getAllUnprocessed();
        })
        .then(function(items) {
          assert.strictEqual(items.length, 0);
        });
    });
  });
});
