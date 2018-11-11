/* global _, textsecure, libsignal, storage */

'use strict';

describe('SignalProtocolStore', () => {
  const number = '+5558675309';
  let store;
  let identityKey;
  let testKey;

  before(done => {
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

  describe('getLocalRegistrationId', () => {
    it('retrieves my registration id', async () => {
      const id = await store.getLocalRegistrationId();
      assert.strictEqual(id, 1337);
    });
  });
  describe('getIdentityKeyPair', () => {
    it('retrieves my identity key', async () => {
      const key = await store.getIdentityKeyPair();
      assertEqualArrayBuffers(key.pubKey, identityKey.pubKey);
      assertEqualArrayBuffers(key.privKey, identityKey.privKey);
    });
  });

  describe('saveIdentity', () => {
    const address = new libsignal.SignalProtocolAddress(number, 1);
    const identifier = address.toString();

    it('stores identity keys', async () => {
      await store.saveIdentity(identifier, testKey.pubKey);
      const key = await store.loadIdentityKey(number);

      assertEqualArrayBuffers(key, testKey.pubKey);
    });
    it('allows key changes', async () => {
      const newIdentity = libsignal.crypto.getRandomBytes(33);
      await store.saveIdentity(identifier, testKey.pubKey);
      await store.saveIdentity(identifier, newIdentity);
    });

    describe('When there is no existing key (first use)', () => {
      before(async () => {
        await store.removeIdentityKey(number);
        await store.saveIdentity(identifier, testKey.pubKey);
      });
      it('marks the key firstUse', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert(identity.firstUse);
      });
      it('sets the timestamp', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert(identity.timestamp);
      });
      it('sets the verified status to DEFAULT', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
      });
    });
    describe('When there is a different existing key (non first use)', () => {
      const newIdentity = libsignal.crypto.getRandomBytes(33);
      const oldTimestamp = Date.now();

      before(async () => {
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
      it('marks the key not firstUse', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert(!identity.firstUse);
      });
      it('updates the timestamp', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.notEqual(identity.timestamp, oldTimestamp);
      });

      describe('The previous verified status was DEFAULT', () => {
        before(async () => {
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
        it('sets the new key to default', async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
        });
      });
      describe('The previous verified status was VERIFIED', () => {
        before(async () => {
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
        it('sets the new key to unverified', async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);

          assert.strictEqual(
            identity.verified,
            store.VerifiedStatus.UNVERIFIED
          );
        });
      });
      describe('The previous verified status was UNVERIFIED', () => {
        before(async () => {
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
        it('sets the new key to unverified', async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          assert.strictEqual(
            identity.verified,
            store.VerifiedStatus.UNVERIFIED
          );
        });
      });
    });
    describe('When the key has not changed', () => {
      const oldTimestamp = Date.now();
      before(async () => {
        await window.Signal.Data.createOrUpdateIdentityKey({
          id: number,
          publicKey: testKey.pubKey,
          timestamp: oldTimestamp,
          nonblockingApproval: false,
          verified: store.VerifiedStatus.DEFAULT,
        });
      });
      describe('If it is marked firstUse', () => {
        before(async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          identity.firstUse = true;
          await window.Signal.Data.createOrUpdateIdentityKey(identity);
        });
        it('nothing changes', async () => {
          await store.saveIdentity(identifier, testKey.pubKey, true);

          const identity = await window.Signal.Data.getIdentityKeyById(number);
          assert(!identity.nonblockingApproval);
          assert.strictEqual(identity.timestamp, oldTimestamp);
        });
      });
      describe('If it is not marked firstUse', () => {
        before(async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          identity.firstUse = false;
          await window.Signal.Data.createOrUpdateIdentityKey(identity);
        });
        describe('If nonblocking approval is required', () => {
          let now;
          before(async () => {
            now = Date.now();
            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );
            identity.timestamp = now;
            await window.Signal.Data.createOrUpdateIdentityKey(identity);
          });
          it('sets non-blocking approval', async () => {
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
  describe('saveIdentityWithAttributes', () => {
    let now;
    let validAttributes;

    before(async () => {
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
    describe('with valid attributes', () => {
      before(async () => {
        await store.saveIdentityWithAttributes(number, validAttributes);
      });

      it('publicKey is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
      });
      it('firstUse is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.firstUse, true);
      });
      it('timestamp is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.timestamp, now);
      });
      it('verified is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
      });
      it('nonblockingApproval is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.nonblockingApproval, false);
      });
    });
    describe('with invalid attributes', () => {
      let attributes;
      beforeEach(() => {
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

      it('rejects an invalid publicKey', async () => {
        attributes.publicKey = 'a string';
        await testInvalidAttributes();
      });
      it('rejects invalid firstUse', async () => {
        attributes.firstUse = 0;
        await testInvalidAttributes();
      });
      it('rejects invalid timestamp', async () => {
        attributes.timestamp = NaN;
        await testInvalidAttributes();
      });
      it('rejects invalid verified', async () => {
        attributes.verified = null;
        await testInvalidAttributes();
      });
      it('rejects invalid nonblockingApproval', async () => {
        attributes.nonblockingApproval = 0;
        await testInvalidAttributes();
      });
    });
  });
  describe('setApproval', () => {
    it('sets nonblockingApproval', async () => {
      await store.setApproval(number, true);
      const identity = await window.Signal.Data.getIdentityKeyById(number);

      assert.strictEqual(identity.nonblockingApproval, true);
    });
  });
  describe('setVerified', () => {
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
    describe('with no public key argument', () => {
      before(saveRecordDefault);
      it('updates the verified status', async () => {
        await store.setVerified(number, store.VerifiedStatus.VERIFIED);

        const identity = await window.Signal.Data.getIdentityKeyById(number);
        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
        assertEqualArrayBuffers(identity.publicKey, testKey.pubKey);
      });
    });
    describe('with the current public key', () => {
      before(saveRecordDefault);
      it('updates the verified status', async () => {
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
    describe('with a mismatching public key', () => {
      const newIdentity = libsignal.crypto.getRandomBytes(33);
      before(saveRecordDefault);
      it('does not change the record.', async () => {
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
  describe('processContactSyncVerificationState', () => {
    const newIdentity = libsignal.crypto.getRandomBytes(33);
    let keychangeTriggered;

    beforeEach(() => {
      keychangeTriggered = 0;
      store.bind('keychange', () => {
        keychangeTriggered += 1;
      });
    });
    afterEach(() => {
      store.unbind('keychange');
    });

    describe('when the new verified status is DEFAULT', () => {
      describe('when there is no existing record', () => {
        before(async () => {
          await window.Signal.Data.removeIdentityKeyById(number);
        });

        it('does nothing', async () => {
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
      describe('when the record exists', () => {
        describe('when the existing key is different', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('does not save the new identity (because this is a less secure state)', async () => {
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
        describe('when the existing key is the same but VERIFIED', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('updates the verified status', async () => {
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
        describe('when the existing key is the same and already DEFAULT', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.DEFAULT,
              nonblockingApproval: false,
            });
          });

          it('does not hang', async () => {
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
    describe('when the new verified status is UNVERIFIED', () => {
      describe('when there is no existing record', () => {
        before(async () => {
          await window.Signal.Data.removeIdentityKeyById(number);
        });

        it('saves the new identity and marks it verified', async () => {
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
      describe('when the record exists', () => {
        describe('when the existing key is different', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('saves the new identity and marks it UNVERIFIED', async () => {
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
        describe('when the key exists and is DEFAULT', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.DEFAULT,
              nonblockingApproval: false,
            });
          });

          it('updates the verified status', async () => {
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
        describe('when the key exists and is already UNVERIFIED', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.UNVERIFIED,
              nonblockingApproval: false,
            });
          });

          it('does not hang', async () => {
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
    describe('when the new verified status is VERIFIED', () => {
      describe('when there is no existing record', () => {
        before(async () => {
          await window.Signal.Data.removeIdentityKeyById(number);
        });

        it('saves the new identity and marks it verified', async () => {
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
      describe('when the record exists', () => {
        describe('when the existing key is different', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('saves the new identity and marks it VERIFIED', async () => {
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
        describe('when the existing key is the same but UNVERIFIED', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.UNVERIFIED,
              nonblockingApproval: false,
            });
          });

          it('saves the identity and marks it verified', async () => {
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
        describe('when the existing key is the same and already VERIFIED', () => {
          before(async () => {
            await window.Signal.Data.createOrUpdateIdentityKey({
              id: number,
              publicKey: testKey.pubKey,
              firstUse: true,
              timestamp: Date.now(),
              verified: store.VerifiedStatus.VERIFIED,
              nonblockingApproval: false,
            });
          });

          it('does not hang', async () => {
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

  describe('isUntrusted', () => {
    it('returns false if identity key old enough', async () => {
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

    it('returns false if new but nonblockingApproval is true', async () => {
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

    it('returns false if new but firstUse is true', async () => {
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

    it('returns true if new, and no flags are set', async () => {
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

  describe('getVerified', () => {
    before(async () => {
      await store.setVerified(number, store.VerifiedStatus.VERIFIED);
    });
    it('resolves to the verified status', async () => {
      const result = await store.getVerified(number);
      assert.strictEqual(result, store.VerifiedStatus.VERIFIED);
    });
  });
  describe('isTrustedIdentity', () => {
    const address = new libsignal.SignalProtocolAddress(number, 1);
    const identifier = address.toString();

    describe('When invalid direction is given', () => {
      it('should fail', async () => {
        try {
          await store.isTrustedIdentity(number, testKey.pubKey);
          throw new Error('isTrustedIdentity should have failed');
        } catch (error) {
          // good
        }
      });
    });
    describe('When direction is RECEIVING', () => {
      it('always returns true', async () => {
        const newIdentity = libsignal.crypto.getRandomBytes(33);
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
    describe('When direction is SENDING', () => {
      describe('When there is no existing key (first use)', () => {
        before(async () => {
          await store.removeIdentityKey(number);
        });
        it('returns true', async () => {
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
      describe('When there is an existing key', () => {
        before(async () => {
          await store.saveIdentity(identifier, testKey.pubKey);
        });
        describe('When the existing key is different', () => {
          it('returns false', async () => {
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
        describe('When the existing key matches the new key', () => {
          const newIdentity = libsignal.crypto.getRandomBytes(33);
          before(async () => {
            await store.saveIdentity(identifier, newIdentity);
          });
          it('returns false if keys match but we just received this new identiy', async () => {
            const trusted = await store.isTrustedIdentity(
              identifier,
              newIdentity,
              store.Direction.SENDING
            );

            if (trusted) {
              throw new Error('isTrusted returned true on untrusted key');
            }
          });
          it('returns true if we have already approved identity', async () => {
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
  describe('storePreKey', () => {
    it('stores prekeys', async () => {
      await store.storePreKey(1, testKey);
      const key = await store.loadPreKey(1);
      assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
      assertEqualArrayBuffers(key.privKey, testKey.privKey);
    });
  });
  describe('removePreKey', () => {
    before(async () => {
      await store.storePreKey(2, testKey);
    });
    it('deletes prekeys', async () => {
      await store.removePreKey(2, testKey);

      const key = await store.loadPreKey(2);
      assert.isUndefined(key);
    });
  });
  describe('storeSignedPreKey', () => {
    it('stores signed prekeys', async () => {
      await store.storeSignedPreKey(3, testKey);

      const key = await store.loadSignedPreKey(3);
      assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
      assertEqualArrayBuffers(key.privKey, testKey.privKey);
    });
  });
  describe('removeSignedPreKey', () => {
    before(async () => {
      await store.storeSignedPreKey(4, testKey);
    });
    it('deletes signed prekeys', async () => {
      await store.removeSignedPreKey(4, testKey);

      const key = await store.loadSignedPreKey(4);
      assert.isUndefined(key);
    });
  });
  describe('storeSession', () => {
    it('stores sessions', async () => {
      const testRecord = 'an opaque string';

      await store.storeSession(`${number}.1`, testRecord);
      const record = await store.loadSession(`${number}.1`);

      assert.deepEqual(record, testRecord);
    });
  });
  describe('removeAllSessions', () => {
    it('removes all sessions for a number', async () => {
      const testRecord = 'an opaque string';
      const devices = [1, 2, 3].map(deviceId => {
        return [number, deviceId].join('.');
      });

      await Promise.all(
        devices.map(async encodedNumber => {
          await store.storeSession(encodedNumber, testRecord + encodedNumber);
        })
      );

      await store.removeAllSessions(number);

      const records = await Promise.all(
        devices.map(store.loadSession.bind(store))
      );

      for (let i = 0, max = records.length; i < max; i += 1) {
        assert.isUndefined(records[i]);
      }
    });
  });
  describe('clearSessionStore', () => {
    it('clears the session store', async () => {
      const testRecord = 'an opaque string';
      await store.storeSession(`${number}.1`, testRecord);
      await store.clearSessionStore();

      const record = await store.loadSession(`${number}.1`);
      assert.isUndefined(record);
    });
  });
  describe('getDeviceIds', () => {
    it('returns deviceIds for a number', async () => {
      const testRecord = 'an opaque string';
      const devices = [1, 2, 3].map(deviceId => {
        return [number, deviceId].join('.');
      });

      await Promise.all(
        devices.map(async encodedNumber => {
          await store.storeSession(encodedNumber, testRecord + encodedNumber);
        })
      );

      const deviceIds = await store.getDeviceIds(number);
      assert.sameMembers(deviceIds, [1, 2, 3]);
    });
    it('returns empty array for a number with no device ids', async () => {
      const deviceIds = await store.getDeviceIds('foo');
      assert.sameMembers(deviceIds, []);
    });
  });

  describe('Not yet processed messages', () => {
    beforeEach(async () => {
      await store.removeAllUnprocessed();
      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 0);
    });

    it('adds two and gets them back', async () => {
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

    it('saveUnprocessed successfully updates item', async () => {
      const id = 1;
      await store.addUnprocessed({ id, name: 'first', timestamp: 1 });
      await store.saveUnprocessed({ id, name: 'updated', timestamp: 1 });

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].name, 'updated');
      assert.strictEqual(items[0].timestamp, 1);
    });

    it('removeUnprocessed successfully deletes item', async () => {
      const id = 1;
      await store.addUnprocessed({ id, name: 'first', timestamp: 1 });
      await store.removeUnprocessed(id);

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 0);
    });
  });
});
