'use strict';

describe('SignalProtocolStore', function() {
  var number = '+5558675309';
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
    it('retrieves my registration id', async function() {
      const id = await store.getLocalRegistrationId();
      assert.strictEqual(id, 1337);
    });
  });
  describe('getIdentityKeyPair', function() {
    it('retrieves my identity key', async function() {
      const key = await store.getIdentityKeyPair();
      assertEqualArrayBuffers(key.pubKey, identityKey.pubKey);
      assertEqualArrayBuffers(key.privKey, identityKey.privKey);
    });
  });

  describe('saveIdentity', function() {
    var address = new libsignal.SignalProtocolAddress(number, 1);
    var identifier = address.toString();

    it('stores identity keys', async function() {
      await store.saveIdentity(identifier, testKey.pubKey);
      const key = await store.loadIdentityKey(number);

      assertEqualArrayBuffers(key, testKey.pubKey);
    });
    it('allows key changes', async function() {
      var newIdentity = libsignal.crypto.getRandomBytes(33);
      await store.saveIdentity(identifier, testKey.pubKey);
      await store.saveIdentity(identifier, newIdentity);
    });

    describe('When there is no existing key (first use)', function() {
      before(async function() {
        await store.removeIdentityKey(number);
        await store.saveIdentity(identifier, testKey.pubKey);
      });
      it('marks the key firstUse', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert(identity.firstUse);
      });
      it('sets the timestamp', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert(identity.timestamp);
      });
      it('sets the verified status to DEFAULT', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
      });
    });
    describe('When there is a different existing key (non first use)', function() {
      const newIdentity = libsignal.crypto.getRandomBytes(33);
      const oldTimestamp = Date.now();

      before(async function() {
        await window.Signal.Data.createOrUpdateIdentityKey({
          id: identifier,
          publicKey: testKey.pubKey,
          firstUse: true,
          timestamp: oldTimestamp,
          nonblockingApproval: false,
          verified: store.VerifiedStatus.DEFAULT,
        });

        await store.saveIdentity(identifier, newIdentity);
      });
      it('marks the key not firstUse', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert(!identity.firstUse);
      });
      it('updates the timestamp', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.notEqual(identity.timestamp, oldTimestamp);
      });

      describe('The previous verified status was DEFAULT', function() {
        before(async function() {
          await window.Signal.Data.createOrUpdateIdentityKey({
            id: number,
            publicKey: testKey.pubKey,
            firstUse: true,
            timestamp: oldTimestamp,
            nonblockingApproval: false,
            verified: store.VerifiedStatus.DEFAULT,
          });

          await store.saveIdentity(identifier, newIdentity);
        });
        it('sets the new key to default', async function() {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
        });
      });
      describe('The previous verified status was VERIFIED', function() {
        before(async function() {
          await window.Signal.Data.createOrUpdateIdentityKey({
            id: number,
            publicKey: testKey.pubKey,
            firstUse: true,
            timestamp: oldTimestamp,
            nonblockingApproval: false,
            verified: store.VerifiedStatus.VERIFIED,
          });
          await store.saveIdentity(identifier, newIdentity);
        });
        it('sets the new key to unverified', async function() {
          const identity = await window.Signal.Data.getIdentityKeyById(number);

          assert.strictEqual(
            identity.verified,
            store.VerifiedStatus.UNVERIFIED
          );
        });
      });
      describe('The previous verified status was UNVERIFIED', function() {
        before(async function() {
          await window.Signal.Data.createOrUpdateIdentityKey({
            id: number,
            publicKey: testKey.pubKey,
            firstUse: true,
            timestamp: oldTimestamp,
            nonblockingApproval: false,
            verified: store.VerifiedStatus.UNVERIFIED,
          });

          await store.saveIdentity(identifier, newIdentity);
        });
        it('sets the new key to unverified', async function() {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          assert.strictEqual(
            identity.verified,
            store.VerifiedStatus.UNVERIFIED
          );
        });
      });
    });
    describe('When the key has not changed', function() {
      var oldTimestamp = Date.now();
      before(async function() {
        await window.Signal.Data.createOrUpdateIdentityKey({
          id: number,
          publicKey: testKey.pubKey,
          timestamp: oldTimestamp,
          nonblockingApproval: false,
          verified: store.VerifiedStatus.DEFAULT,
        });
      });
      describe('If it is marked firstUse', function() {
        before(async function() {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          identity.firstUse = true;
          await window.Signal.Data.createOrUpdateIdentityKey(identity);
        });
        it('nothing changes', async function() {
          await store.saveIdentity(identifier, testKey.pubKey, true);

          const identity = await window.Signal.Data.getIdentityKeyById(number);
          assert(!identity.nonblockingApproval);
          assert.strictEqual(identity.timestamp, oldTimestamp);
        });
      });
      describe('If it is not marked firstUse', function() {
        before(async function() {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          identity.firstUse = false;
          await window.Signal.Data.createOrUpdateIdentityKey(identity);
        });
        describe('If nonblocking approval is required', function() {
          let now;
          before(async function() {
            now = Date.now();
            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );
            identity.timestamp = now;
            await window.Signal.Data.createOrUpdateIdentityKey(identity);
          });
          it('sets non-blocking approval', async function() {
            await store.saveIdentity(identifier, testKey.pubKey, true);

            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );

            assert.strictEqual(identity.nonblockingApproval, true);
            assert.strictEqual(identity.timestamp, now);
            assert.strictEqual(identity.firstUse, false);
          });
        });
      });
    });
  });
  describe('saveIdentityWithAttributes', function() {
    var now;
    var validAttributes;

    before(async function() {
      now = Date.now();
      validAttributes = {
        publicKey: testKey.pubKey,
        firstUse: true,
        timestamp: now,
        verified: store.VerifiedStatus.VERIFIED,
        nonblockingApproval: false,
      };

      await store.removeIdentityKey(number);
    });
    describe('with valid attributes', function() {
      before(async function() {
        await store.saveIdentityWithAttributes(number, validAttributes);
      });

      it('publicKey is saved', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
      });
      it('firstUse is saved', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.firstUse, true);
      });
      it('timestamp is saved', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.timestamp, now);
      });
      it('verified is saved', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
      });
      it('nonblockingApproval is saved', async function() {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.nonblockingApproval, false);
      });
    });
    describe('with invalid attributes', function() {
      var attributes;
      beforeEach(function() {
        attributes = _.clone(validAttributes);
      });

      async function testInvalidAttributes() {
        try {
          await store.saveIdentityWithAttributes(number, attributes);
          throw new Error('saveIdentityWithAttributes should have failed');
        } catch (error) {
          // good. we expect to fail with invalid attributes.
        }
      }

      it('rejects an invalid publicKey', async function() {
        attributes.publicKey = 'a string';
        await testInvalidAttributes();
      });
      it('rejects invalid firstUse', async function() {
        attributes.firstUse = 0;
        await testInvalidAttributes();
      });
      it('rejects invalid timestamp', async function() {
        attributes.timestamp = NaN;
        await testInvalidAttributes();
      });
      it('rejects invalid verified', async function() {
        attributes.verified = null;
        await testInvalidAttributes();
      });
      it('rejects invalid nonblockingApproval', async function() {
        attributes.nonblockingApproval = 0;
        await testInvalidAttributes();
      });
    });
  });
  describe('setApproval', function() {
    it('sets nonblockingApproval', async function() {
      await store.setApproval(number, true);
      const identity = await window.Signal.Data.getIdentityKeyById(number);

      assert.strictEqual(identity.nonblockingApproval, true);
    });
  });
  describe('setVerified', function() {
    var record;
    async function saveRecordDefault() {
      await window.Signal.Data.createOrUpdateIdentityKey({
        id: number,
        publicKey: testKey.pubKey,
        firstUse: true,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        nonblockingApproval: false,
      });
    }
    describe('with no public key argument', function() {
      before(saveRecordDefault);
      it('updates the verified status', async function() {
        await store.setVerified(number, store.VerifiedStatus.VERIFIED);

        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
        assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
      });
    });
    describe('with the current public key', function() {
      before(saveRecordDefault);
      it('updates the verified status', async function() {
        await store.setVerified(
          number,
          store.VerifiedStatus.VERIFIED,
          testKey.pubKey
        );

        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
        assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
      });
    });
    describe('with a mismatching public key', function() {
      var newIdentity = libsignal.crypto.getRandomBytes(33);
      before(saveRecordDefault);
      it('does not change the record.', async function() {
        await store.setVerified(
          number,
          store.VerifiedStatus.VERIFIED,
          newIdentity
        );

        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
        assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
      });
    });
  });
  describe('processContactSyncVerificationState', function() {
    var record;
    var newIdentity = libsignal.crypto.getRandomBytes(33);
    var keychangeTriggered;

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
        before(async function() {
          await window.Signal.Data.removeIdentityKeyById(number);
        });

        it('does nothing', async function() {
          await store.processContactSyncVerificationState(
            number,
            store.VerifiedStatus.DEFAULT,
            newIdentity
          );

          const identity = await window.Signal.Data.getIdentityKeyById(number);

          if (identity) {
            // fetchRecord resolved so there is a record.
            // Bad.
            throw new Error(
              'processContactSyncVerificationState should not save new records'
            );
          }

          assert.strictEqual(keychangeTriggered, 0);
        });
      });
      describe('when the record exists', function() {
        describe('when the existing key is different', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('does not save the new identity (because this is a less secure state)', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.DEFAULT,
              newIdentity
            );

            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.VERIFIED
            );
            assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
            assert.strictEqual(keychangeTriggered, 0);
          });
        });
        describe('when the existing key is the same but VERIFIED', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('updates the verified status', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.DEFAULT,
              testKey.pubKey
            );

            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );

            assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
            assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
            assert.strictEqual(keychangeTriggered, 0);
          });
        });
        describe('when the existing key is the same and already DEFAULT', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.DEFAULT,
              nonblockingApproval: false,
            });
          });

          it('does not hang', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.DEFAULT,
              testKey.pubKey
            );

            assert.strictEqual(keychangeTriggered, 0);
          });
        });
      });
    });
    describe('when the new verified status is UNVERIFIED', function() {
      describe('when there is no existing record', function() {
        before(async function() {
          await window.Signal.Data.removeIdentityKeyById(number);
        });

        it('saves the new identity and marks it verified', async function() {
          await store.processContactSyncVerificationState(
            number,
            store.VerifiedStatus.UNVERIFIED,
            newIdentity
          );

          const identity = await window.Signal.Data.getIdentityKeyById(number);

          assert.strictEqual(
            identity.verified,
            store.VerifiedStatus.UNVERIFIED
          );
          assertEqualArrayBuffers(identity.publicKey, newIdentity);
          assert.strictEqual(keychangeTriggered, 0);
        });
      });
      describe('when the record exists', function() {
        describe('when the existing key is different', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('saves the new identity and marks it UNVERIFIED', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.UNVERIFIED,
              newIdentity
            );

            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.UNVERIFIED
            );
            assertEqualArrayBuffers(identity.publicKey, newIdentity);
            assert.strictEqual(keychangeTriggered, 1);
          });
        });
        describe('when the key exists and is DEFAULT', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.DEFAULT,
              nonblockingApproval: false,
            });
          });

          it('updates the verified status', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.UNVERIFIED,
              testKey.pubKey
            );
            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.UNVERIFIED
            );
            assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
            assert.strictEqual(keychangeTriggered, 0);
          });
        });
        describe('when the key exists and is already UNVERIFIED', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.UNVERIFIED,
              nonblockingApproval: false,
            });
          });

          it('does not hang', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.UNVERIFIED,
              testKey.pubKey
            );

            assert.strictEqual(keychangeTriggered, 0);
          });
        });
      });
    });
    describe('when the new verified status is VERIFIED', function() {
      describe('when there is no existing record', function() {
        before(async function() {
          await window.Signal.Data.removeIdentityKeyById(number);
        });

        it('saves the new identity and marks it verified', async function() {
          await store.processContactSyncVerificationState(
            number,
            store.VerifiedStatus.VERIFIED,
            newIdentity
          );
          const identity = await window.Signal.Data.getIdentityKeyById(number);

          assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
          assertEqualArrayBuffers(identity.publicKey, newIdentity);
          assert.strictEqual(keychangeTriggered, 0);
        });
      });
      describe('when the record exists', function() {
        describe('when the existing key is different', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('saves the new identity and marks it VERIFIED', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.VERIFIED,
              newIdentity
            );

            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.VERIFIED
            );
            assertEqualArrayBuffers(identity.publicKey, newIdentity);
            assert.strictEqual(keychangeTriggered, 1);
          });
        });
        describe('when the existing key is the same but UNVERIFIED', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.UNVERIFIED,
              nonblockingApproval: false,
            });
          });

          it('saves the identity and marks it verified', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.VERIFIED,
              testKey.pubKey
            );
            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.VERIFIED
            );
            assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
            assert.strictEqual(keychangeTriggered, 0);
          });
        });
        describe('when the existing key is the same and already VERIFIED', function() {
          before(async function() {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('does not hang', async function() {
            await store.processContactSyncVerificationState(
              number,
              store.VerifiedStatus.VERIFIED,
              testKey.pubKey
            );

            assert.strictEqual(keychangeTriggered, 0);
          });
        });
      });
    });
  });

  describe('isUntrusted', function() {
    it('returns false if identity key old enough', async function() {
      await window.Signal.Data.createOrUpdateIdentityKey({
        id: number,
        publicKey: testKey.pubKey,
        timestamp: Date.now() - 10 * 1000 * 60,
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: false,
      });

      const untrusted = await store.isUntrusted(number);
      assert.strictEqual(untrusted, false);
    });

    it('returns false if new but nonblockingApproval is true', async function() {
      await window.Signal.Data.createOrUpdateIdentityKey({
        id: number,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: true,
      });

      const untrusted = await store.isUntrusted(number);
      assert.strictEqual(untrusted, false);
    });

    it('returns false if new but firstUse is true', async function() {
      await window.Signal.Data.createOrUpdateIdentityKey({
        id: number,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: true,
        nonblockingApproval: false,
      });

      const untrusted = await store.isUntrusted(number);
      assert.strictEqual(untrusted, false);
    });

    it('returns true if new, and no flags are set', async function() {
      await window.Signal.Data.createOrUpdateIdentityKey({
        id: number,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: false,
      });
      const untrusted = await store.isUntrusted(number);
      assert.strictEqual(untrusted, true);
    });
  });

  describe('getVerified', function() {
    before(async function() {
      await store.setVerified(number, store.VerifiedStatus.VERIFIED);
    });
    it('resolves to the verified status', async function() {
      const result = await store.getVerified(number);
      assert.strictEqual(result, store.VerifiedStatus.VERIFIED);
    });
  });
  describe('isTrustedIdentity', function() {
    const address = new libsignal.SignalProtocolAddress(number, 1);
    const identifier = address.toString();

    describe('When invalid direction is given', function() {
      it('should fail', async function() {
        try {
          await store.isTrustedIdentity(number, testKey.pubKey);
          throw new Error('isTrustedIdentity should have failed');
        } catch (error) {
          // good
        }
      });
    });
    describe('When direction is RECEIVING', function() {
      it('always returns true', async function() {
        var newIdentity = libsignal.crypto.getRandomBytes(33);
        await store.saveIdentity(identifier, testKey.pubKey);

        const trusted = await store.isTrustedIdentity(
          identifier,
          newIdentity,
          store.Direction.RECEIVING
        );

        if (!trusted) {
          throw new Error('isTrusted returned false when receiving');
        }
      });
    });
    describe('When direction is SENDING', function() {
      describe('When there is no existing key (first use)', function() {
        before(async function() {
          await store.removeIdentityKey(number);
        });
        it('returns true', async function() {
          const newIdentity = libsignal.crypto.getRandomBytes(33);
          const trusted = await store.isTrustedIdentity(
            identifier,
            newIdentity,
            store.Direction.SENDING
          );
          if (!trusted) {
            throw new Error('isTrusted returned false on first use');
          }
        });
      });
      describe('When there is an existing key', function() {
        before(async function() {
          await store.saveIdentity(identifier, testKey.pubKey);
        });
        describe('When the existing key is different', function() {
          it('returns false', async function() {
            const newIdentity = libsignal.crypto.getRandomBytes(33);
            const trusted = await store.isTrustedIdentity(
              identifier,
              newIdentity,
              store.Direction.SENDING
            );
            if (trusted) {
              throw new Error('isTrusted returned true on untrusted key');
            }
          });
        });
        describe('When the existing key matches the new key', function() {
          const newIdentity = libsignal.crypto.getRandomBytes(33);
          before(async function() {
            await store.saveIdentity(identifier, newIdentity);
          });
          it('returns false if keys match but we just received this new identiy', async function() {
            const trusted = await store.isTrustedIdentity(
              identifier,
              newIdentity,
              store.Direction.SENDING
            );

            if (trusted) {
              throw new Error('isTrusted returned true on untrusted key');
            }
          });
          it('returns true if we have already approved identity', async function() {
            await store.saveIdentity(identifier, newIdentity, true);

            const trusted = await store.isTrustedIdentity(
              identifier,
              newIdentity,
              store.Direction.SENDING
            );
            if (!trusted) {
              throw new Error('isTrusted returned false on an approved key');
            }
          });
        });
      });
    });
  });
  describe('storePreKey', function() {
    it('stores prekeys', async function() {
      await store.storePreKey(1, testKey);
      const key = await store.loadPreKey(1);
      assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
      assertEqualArrayBuffers(key.privKey, testKey.privKey);
    });
  });
  describe('removePreKey', function() {
    before(async function() {
      await store.storePreKey(2, testKey);
    });
    it('deletes prekeys', async function() {
      await store.removePreKey(2, testKey);

      const key = await store.loadPreKey(2);
      assert.isUndefined(key);
    });
  });
  describe('storeSignedPreKey', function() {
    it('stores signed prekeys', async function() {
      await store.storeSignedPreKey(3, testKey);

      const key = await store.loadSignedPreKey(3);
      assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
      assertEqualArrayBuffers(key.privKey, testKey.privKey);
    });
  });
  describe('removeSignedPreKey', function() {
    before(async function() {
      await store.storeSignedPreKey(4, testKey);
    });
    it('deletes signed prekeys', async function() {
      await store.removeSignedPreKey(4, testKey);

      const key = await store.loadSignedPreKey(4);
      assert.isUndefined(key);
    });
  });
  describe('storeSession', function() {
    it('stores sessions', async function() {
      const testRecord = 'an opaque string';

      await store.storeSession(number + '.1', testRecord);
      const record = await store.loadSession(number + '.1');

      assert.deepEqual(record, testRecord);
    });
  });
  describe('removeAllSessions', function() {
    it('removes all sessions for a number', async function() {
      const testRecord = 'an opaque string';
      const devices = [1, 2, 3].map(function(deviceId) {
        return [number, deviceId].join('.');
      });

      await Promise.all(
        devices.map(async function(encodedNumber) {
          await store.storeSession(encodedNumber, testRecord + encodedNumber);
        })
      );

      await store.removeAllSessions(number);

      const records = await Promise.all(
        devices.map(store.loadSession.bind(store))
      );
      for (var i in records) {
        assert.isUndefined(records[i]);
      }
    });
  });
  describe('clearSessionStore', function() {
    it('clears the session store', async function() {
      const testRecord = 'an opaque string';
      await store.storeSession(number + '.1', testRecord);
      await store.clearSessionStore();

      const record = await store.loadSession(number + '.1');
      assert.isUndefined(record);
    });
  });
  describe('getDeviceIds', function() {
    it('returns deviceIds for a number', async function() {
      const testRecord = 'an opaque string';
      const devices = [1, 2, 3].map(function(deviceId) {
        return [number, deviceId].join('.');
      });

      await Promise.all(
        devices.map(async function(encodedNumber) {
          await store.storeSession(encodedNumber, testRecord + encodedNumber);
        })
      );

      const deviceIds = await store.getDeviceIds(number);
      assert.sameMembers(deviceIds, [1, 2, 3]);
    });
    it('returns empty array for a number with no device ids', async function() {
      const deviceIds = await store.getDeviceIds('foo');
      assert.sameMembers(deviceIds, []);
    });
  });

  describe('Not yet processed messages', function() {
    beforeEach(async function() {
      await store.removeAllUnprocessed();
      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 0);
    });

    it('adds two and gets them back', async function() {
      await Promise.all([
        store.addUnprocessed({ id: 2, name: 'second', timestamp: 2 }),
        store.addUnprocessed({ id: 3, name: 'third', timestamp: 3 }),
        store.addUnprocessed({ id: 1, name: 'first', timestamp: 1 }),
      ]);

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 3);

      // they are in the proper order because the collection comparator is 'timestamp'
      assert.strictEqual(items[0].name, 'first');
      assert.strictEqual(items[1].name, 'second');
      assert.strictEqual(items[2].name, 'third');
    });

    it('saveUnprocessed successfully updates item', async function() {
      const id = 1;
      await store.addUnprocessed({ id: id, name: 'first', timestamp: 1 });
      await store.saveUnprocessed({ id, name: 'updated', timestamp: 1 });

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'updated');
      assert.strictEqual(items[0].timestamp, 1);
    });

    it('removeUnprocessed successfully deletes item', async function() {
      const id = 1;
      await store.addUnprocessed({ id: id, name: 'first', timestamp: 1 });
      await store.removeUnprocessed(id);

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 0);
    });
  });
});
