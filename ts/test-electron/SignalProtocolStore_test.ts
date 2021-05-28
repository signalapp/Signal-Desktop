// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */

import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  Direction,
  SenderKeyRecord,
  SessionRecord,
} from '@signalapp/signal-client';

import { signal } from '../protobuf/compiled';
import { sessionStructureToArrayBuffer } from '../util/sessionTranslation';
import { Zone } from '../util/Zone';

import { getRandomBytes, constantTimeEqual } from '../Crypto';
import { clampPrivateKey, setPublicKeyTypeByte } from '../Curve';
import { SignalProtocolStore, GLOBAL_ZONE } from '../SignalProtocolStore';
import { IdentityKeyType, KeyPairType } from '../textsecure/Types.d';

chai.use(chaiAsPromised);

const {
  RecordStructure,
  SessionStructure,
  SenderKeyRecordStructure,
  SenderKeyStateStructure,
} = signal.proto.storage;

describe('SignalProtocolStore', () => {
  const number = '+5558675309';
  let store: SignalProtocolStore;
  let identityKey: KeyPairType;
  let testKey: KeyPairType;

  function getSessionRecord(isOpen?: boolean): SessionRecord {
    const proto = new RecordStructure();

    proto.previousSessions = [];

    if (isOpen) {
      proto.currentSession = new SessionStructure();

      proto.currentSession.aliceBaseKey = toUint8Array(getPublicKey());
      proto.currentSession.localIdentityPublic = toUint8Array(getPublicKey());
      proto.currentSession.localRegistrationId = 435;

      proto.currentSession.previousCounter = 1;
      proto.currentSession.remoteIdentityPublic = toUint8Array(getPublicKey());
      proto.currentSession.remoteRegistrationId = 243;

      proto.currentSession.rootKey = toUint8Array(getPrivateKey());
      proto.currentSession.sessionVersion = 3;
    }

    return SessionRecord.deserialize(
      Buffer.from(sessionStructureToArrayBuffer(proto))
    );
  }

  function getSenderKeyRecord(): SenderKeyRecord {
    const proto = new SenderKeyRecordStructure();

    const state = new SenderKeyStateStructure();

    state.senderKeyId = 4;

    const senderChainKey = new SenderKeyStateStructure.SenderChainKey();

    senderChainKey.iteration = 10;
    senderChainKey.seed = toUint8Array(getPublicKey());
    state.senderChainKey = senderChainKey;

    const senderSigningKey = new SenderKeyStateStructure.SenderSigningKey();
    senderSigningKey.public = toUint8Array(getPublicKey());
    senderSigningKey.private = toUint8Array(getPrivateKey());

    state.senderSigningKey = senderSigningKey;

    state.senderMessageKeys = [];
    const messageKey = new SenderKeyStateStructure.SenderMessageKey();
    messageKey.iteration = 234;
    messageKey.seed = toUint8Array(getPublicKey());
    state.senderMessageKeys.push(messageKey);

    proto.senderKeyStates = [];
    proto.senderKeyStates.push(state);

    return SenderKeyRecord.deserialize(
      Buffer.from(
        signal.proto.storage.SenderKeyRecordStructure.encode(proto).finish()
      )
    );
  }

  function toUint8Array(buffer: ArrayBuffer): Uint8Array {
    return new Uint8Array(buffer);
  }

  function getPrivateKey() {
    const key = getRandomBytes(32);
    clampPrivateKey(key);
    return key;
  }
  function getPublicKey() {
    const key = getRandomBytes(33);
    setPublicKeyTypeByte(key);
    return key;
  }

  before(async () => {
    store = window.textsecure.storage.protocol;
    store.hydrateCaches();
    identityKey = {
      pubKey: getPublicKey(),
      privKey: getPrivateKey(),
    };
    testKey = {
      pubKey: getPublicKey(),
      privKey: getPrivateKey(),
    };

    setPublicKeyTypeByte(identityKey.pubKey);
    setPublicKeyTypeByte(testKey.pubKey);

    clampPrivateKey(identityKey.privKey);
    clampPrivateKey(testKey.privKey);

    window.storage.put('registrationId', 1337);
    window.storage.put('identityKey', identityKey);
    await window.storage.fetch();

    window.ConversationController.reset();
    await window.ConversationController.load();
    await window.ConversationController.getOrCreateAndWait(number, 'private');
  });

  describe('getLocalRegistrationId', () => {
    it('retrieves my registration id', async () => {
      await store.hydrateCaches();
      const id = await store.getLocalRegistrationId();
      assert.strictEqual(id, 1337);
    });
  });
  describe('getIdentityKeyPair', () => {
    it('retrieves my identity key', async () => {
      await store.hydrateCaches();
      const key = await store.getIdentityKeyPair();
      if (!key) {
        throw new Error('Missing key!');
      }

      assert.isTrue(constantTimeEqual(key.pubKey, identityKey.pubKey));
      assert.isTrue(constantTimeEqual(key.privKey, identityKey.privKey));
    });
  });

  describe('senderKeys', () => {
    it('roundtrips in memory', async () => {
      const distributionId = window.getGuid();
      const expected = getSenderKeyRecord();

      const deviceId = 1;
      const encodedAddress = `${number}.${deviceId}`;

      await store.saveSenderKey(encodedAddress, distributionId, expected);

      const actual = await store.getSenderKey(encodedAddress, distributionId);
      if (!actual) {
        throw new Error('getSenderKey returned nothing!');
      }

      assert.isTrue(
        constantTimeEqual(expected.serialize(), actual.serialize())
      );

      await store.removeSenderKey(encodedAddress, distributionId);

      const postDeleteGet = await store.getSenderKey(
        encodedAddress,
        distributionId
      );
      assert.isUndefined(postDeleteGet);
    });

    it('roundtrips through database', async () => {
      const distributionId = window.getGuid();
      const expected = getSenderKeyRecord();

      const deviceId = 1;
      const encodedAddress = `${number}.${deviceId}`;

      await store.saveSenderKey(encodedAddress, distributionId, expected);

      // Re-fetch from the database to ensure we get the latest database value
      await store.hydrateCaches();

      const actual = await store.getSenderKey(encodedAddress, distributionId);
      if (!actual) {
        throw new Error('getSenderKey returned nothing!');
      }

      assert.isTrue(
        constantTimeEqual(expected.serialize(), actual.serialize())
      );

      await store.removeSenderKey(encodedAddress, distributionId);

      // Re-fetch from the database to ensure we get the latest database value
      await store.hydrateCaches();

      const postDeleteGet = await store.getSenderKey(
        encodedAddress,
        distributionId
      );
      assert.isUndefined(postDeleteGet);
    });
  });

  describe('saveIdentity', () => {
    const identifier = `${number}.1`;

    it('stores identity keys', async () => {
      await store.saveIdentity(identifier, testKey.pubKey);
      const key = await store.loadIdentityKey(number);
      if (!key) {
        throw new Error('Missing key!');
      }

      assert.isTrue(constantTimeEqual(key, testKey.pubKey));
    });
    it('allows key changes', async () => {
      const newIdentity = getPublicKey();
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
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert(identity.firstUse);
      });
      it('sets the timestamp', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert(identity.timestamp);
      });
      it('sets the verified status to DEFAULT', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
      });
    });
    describe('When there is a different existing key (non first use)', () => {
      const newIdentity = getPublicKey();
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

        await store.hydrateCaches();
        await store.saveIdentity(identifier, newIdentity);
      });
      it('marks the key not firstUse', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert(!identity.firstUse);
      });
      it('updates the timestamp', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
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
          await store.hydrateCaches();

          await store.saveIdentity(identifier, newIdentity);
        });
        it('sets the new key to default', async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }
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

          await store.hydrateCaches();
          await store.saveIdentity(identifier, newIdentity);
        });
        it('sets the new key to unverified', async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }
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

          await store.hydrateCaches();
          await store.saveIdentity(identifier, newIdentity);
        });
        it('sets the new key to unverified', async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }
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
          firstUse: false,
          verified: store.VerifiedStatus.DEFAULT,
        });
        await store.hydrateCaches();
      });
      describe('If it is marked firstUse', () => {
        before(async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }
          identity.firstUse = true;
          await window.Signal.Data.createOrUpdateIdentityKey(identity);
          await store.hydrateCaches();
        });
        it('nothing changes', async () => {
          await store.saveIdentity(identifier, testKey.pubKey, true);

          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }
          assert(!identity.nonblockingApproval);
          assert.strictEqual(identity.timestamp, oldTimestamp);
        });
      });
      describe('If it is not marked firstUse', () => {
        before(async () => {
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }
          identity.firstUse = false;
          await window.Signal.Data.createOrUpdateIdentityKey(identity);
          await store.hydrateCaches();
        });
        describe('If nonblocking approval is required', () => {
          let now: number;
          before(async () => {
            now = Date.now();
            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );
            if (!identity) {
              throw new Error('Missing identity!');
            }
            identity.timestamp = now;
            await window.Signal.Data.createOrUpdateIdentityKey(identity);
            await store.hydrateCaches();
          });
          it('sets non-blocking approval', async () => {
            await store.saveIdentity(identifier, testKey.pubKey, true);

            const identity = await window.Signal.Data.getIdentityKeyById(
              number
            );
            if (!identity) {
              throw new Error('Missing identity!');
            }

            assert.strictEqual(identity.nonblockingApproval, true);
            assert.strictEqual(identity.timestamp, now);
            assert.strictEqual(identity.firstUse, false);
          });
        });
      });
    });
  });
  describe('saveIdentityWithAttributes', () => {
    let now: number;
    let validAttributes: IdentityKeyType;

    before(async () => {
      now = Date.now();
      validAttributes = {
        id: number,
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
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.isTrue(constantTimeEqual(identity.publicKey, testKey.pubKey));
      });
      it('firstUse is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.firstUse, true);
      });
      it('timestamp is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.timestamp, now);
      });
      it('verified is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
      });
      it('nonblockingApproval is saved', async () => {
        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.nonblockingApproval, false);
      });
    });
    describe('with invalid attributes', () => {
      let attributes: IdentityKeyType;
      beforeEach(() => {
        attributes = window._.clone(validAttributes);
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
        attributes.publicKey = 'a string' as any;
        await testInvalidAttributes();
      });
      it('rejects invalid firstUse', async () => {
        attributes.firstUse = 0 as any;
        await testInvalidAttributes();
      });
      it('rejects invalid timestamp', async () => {
        attributes.timestamp = NaN as any;
        await testInvalidAttributes();
      });
      it('rejects invalid verified', async () => {
        attributes.verified = null as any;
        await testInvalidAttributes();
      });
      it('rejects invalid nonblockingApproval', async () => {
        attributes.nonblockingApproval = 0 as any;
        await testInvalidAttributes();
      });
    });
  });
  describe('setApproval', () => {
    it('sets nonblockingApproval', async () => {
      await store.setApproval(number, true);
      const identity = await window.Signal.Data.getIdentityKeyById(number);
      if (!identity) {
        throw new Error('Missing identity!');
      }

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
      await store.hydrateCaches();
    }
    describe('with no public key argument', () => {
      before(saveRecordDefault);
      it('updates the verified status', async () => {
        await store.setVerified(number, store.VerifiedStatus.VERIFIED);

        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }

        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
        assert.isTrue(constantTimeEqual(identity.publicKey, testKey.pubKey));
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
        if (!identity) {
          throw new Error('Missing identity!');
        }

        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
        assert.isTrue(constantTimeEqual(identity.publicKey, testKey.pubKey));
      });
    });
    describe('with a mismatching public key', () => {
      const newIdentity = getPublicKey();
      before(saveRecordDefault);
      it('does not change the record.', async () => {
        await store.setVerified(
          number,
          store.VerifiedStatus.VERIFIED,
          newIdentity
        );

        const identity = await window.Signal.Data.getIdentityKeyById(number);
        if (!identity) {
          throw new Error('Missing identity!');
        }

        assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
        assert.isTrue(constantTimeEqual(identity.publicKey, testKey.pubKey));
      });
    });
  });
  describe('processContactSyncVerificationState', () => {
    const newIdentity = getPublicKey();
    let keychangeTriggered: number;

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
          await store.hydrateCaches();
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
            await store.hydrateCaches();
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
            if (!identity) {
              throw new Error('Missing identity!');
            }

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.VERIFIED
            );
            assert.isTrue(
              constantTimeEqual(identity.publicKey, testKey.pubKey)
            );
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
            await store.hydrateCaches();
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
            if (!identity) {
              throw new Error('Missing identity!');
            }

            assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
            assert.isTrue(
              constantTimeEqual(identity.publicKey, testKey.pubKey)
            );
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
            await store.hydrateCaches();
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
          await store.hydrateCaches();
        });

        it('saves the new identity and marks it verified', async () => {
          await store.processContactSyncVerificationState(
            number,
            store.VerifiedStatus.UNVERIFIED,
            newIdentity
          );

          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }

          assert.strictEqual(
            identity.verified,
            store.VerifiedStatus.UNVERIFIED
          );
          assert.isTrue(constantTimeEqual(identity.publicKey, newIdentity));
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
            await store.hydrateCaches();
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
            if (!identity) {
              throw new Error('Missing identity!');
            }

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.UNVERIFIED
            );
            assert.isTrue(constantTimeEqual(identity.publicKey, newIdentity));
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
            await store.hydrateCaches();
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
            if (!identity) {
              throw new Error('Missing identity!');
            }

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.UNVERIFIED
            );
            assert.isTrue(
              constantTimeEqual(identity.publicKey, testKey.pubKey)
            );
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
            await store.hydrateCaches();
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
          await store.hydrateCaches();
        });

        it('saves the new identity and marks it verified', async () => {
          await store.processContactSyncVerificationState(
            number,
            store.VerifiedStatus.VERIFIED,
            newIdentity
          );
          const identity = await window.Signal.Data.getIdentityKeyById(number);
          if (!identity) {
            throw new Error('Missing identity!');
          }

          assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
          assert.isTrue(constantTimeEqual(identity.publicKey, newIdentity));
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
            await store.hydrateCaches();
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
            if (!identity) {
              throw new Error('Missing identity!');
            }

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.VERIFIED
            );
            assert.isTrue(constantTimeEqual(identity.publicKey, newIdentity));
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
            await store.hydrateCaches();
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
            if (!identity) {
              throw new Error('Missing identity!');
            }

            assert.strictEqual(
              identity.verified,
              store.VerifiedStatus.VERIFIED
            );
            assert.isTrue(
              constantTimeEqual(identity.publicKey, testKey.pubKey)
            );
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
            await store.hydrateCaches();
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

      await store.hydrateCaches();
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
      await store.hydrateCaches();

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
      await store.hydrateCaches();

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
      await store.hydrateCaches();

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
    const identifier = `${number}.1`;

    describe('When invalid direction is given', () => {
      it('should fail', async () => {
        try {
          await store.isTrustedIdentity(number, testKey.pubKey, 'dir' as any);
          throw new Error('isTrustedIdentity should have failed');
        } catch (error) {
          // good
        }
      });
    });
    describe('When direction is RECEIVING', () => {
      it('always returns true', async () => {
        const newIdentity = getPublicKey();
        await store.saveIdentity(identifier, testKey.pubKey);

        const trusted = await store.isTrustedIdentity(
          identifier,
          newIdentity,
          Direction.Receiving
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
          const newIdentity = getPublicKey();
          const trusted = await store.isTrustedIdentity(
            identifier,
            newIdentity,
            Direction.Sending
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
            const newIdentity = getPublicKey();
            const trusted = await store.isTrustedIdentity(
              identifier,
              newIdentity,
              Direction.Sending
            );
            if (trusted) {
              throw new Error('isTrusted returned true on untrusted key');
            }
          });
        });
        describe('When the existing key matches the new key', () => {
          const newIdentity = getPublicKey();
          before(async () => {
            await store.saveIdentity(identifier, newIdentity);
          });
          it('returns false if keys match but we just received this new identiy', async () => {
            const trusted = await store.isTrustedIdentity(
              identifier,
              newIdentity,
              Direction.Sending
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
              Direction.Sending
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
      if (!key) {
        throw new Error('Missing key!');
      }

      const keyPair = {
        pubKey: window.Signal.Crypto.typedArrayToArrayBuffer(
          key.publicKey().serialize()
        ),
        privKey: window.Signal.Crypto.typedArrayToArrayBuffer(
          key.privateKey().serialize()
        ),
      };

      assert.isTrue(constantTimeEqual(keyPair.pubKey, testKey.pubKey));
      assert.isTrue(constantTimeEqual(keyPair.privKey, testKey.privKey));
    });
  });
  describe('removePreKey', () => {
    before(async () => {
      await store.storePreKey(2, testKey);
    });
    it('deletes prekeys', async () => {
      await store.removePreKey(2);

      const key = await store.loadPreKey(2);
      assert.isUndefined(key);
    });
  });
  describe('storeSignedPreKey', () => {
    it('stores signed prekeys', async () => {
      await store.storeSignedPreKey(3, testKey);
      const key = await store.loadSignedPreKey(3);
      if (!key) {
        throw new Error('Missing key!');
      }

      const keyPair = {
        pubKey: window.Signal.Crypto.typedArrayToArrayBuffer(
          key.publicKey().serialize()
        ),
        privKey: window.Signal.Crypto.typedArrayToArrayBuffer(
          key.privateKey().serialize()
        ),
      };

      assert.isTrue(constantTimeEqual(keyPair.pubKey, testKey.pubKey));
      assert.isTrue(constantTimeEqual(keyPair.privKey, testKey.privKey));
    });
  });
  describe('removeSignedPreKey', () => {
    before(async () => {
      await store.storeSignedPreKey(4, testKey);
    });
    it('deletes signed prekeys', async () => {
      await store.removeSignedPreKey(4);

      const key = await store.loadSignedPreKey(4);
      assert.isUndefined(key);
    });
  });
  describe('storeSession', () => {
    it('stores sessions', async () => {
      const testRecord = getSessionRecord();
      await store.storeSession(`${number}.1`, testRecord);
      const record = await store.loadSession(`${number}.1`);
      if (!record) {
        throw new Error('Missing record!');
      }

      assert.equal(record, testRecord);
    });
  });
  describe('removeAllSessions', () => {
    it('removes all sessions for a number', async () => {
      const devices = [1, 2, 3].map(deviceId => {
        return [number, deviceId].join('.');
      });

      await Promise.all(
        devices.map(async encodedNumber => {
          await store.storeSession(encodedNumber, getSessionRecord());
        })
      );

      await store.removeAllSessions(number);

      const records = await Promise.all(
        devices.map(device => store.loadSession(device))
      );

      for (let i = 0, max = records.length; i < max; i += 1) {
        assert.isUndefined(records[i]);
      }
    });
  });
  describe('clearSessionStore', () => {
    it('clears the session store', async () => {
      const testRecord = getSessionRecord();
      await store.storeSession(`${number}.1`, testRecord);
      await store.clearSessionStore();

      const record = await store.loadSession(`${number}.1`);
      assert.isUndefined(record);
    });
  });
  describe('getDeviceIds', () => {
    it('returns deviceIds for a number', async () => {
      const openRecord = getSessionRecord(true);
      const openDevices = [1, 2, 3, 10].map(deviceId => {
        return [number, deviceId].join('.');
      });
      await Promise.all(
        openDevices.map(async encodedNumber => {
          await store.storeSession(encodedNumber, openRecord);
        })
      );

      const closedRecord = getSessionRecord(false);
      await store.storeSession([number, 11].join('.'), closedRecord);

      const deviceIds = await store.getDeviceIds(number);
      assert.sameMembers(deviceIds, [1, 2, 3, 10]);
    });

    it('returns empty array for a number with no device ids', async () => {
      const deviceIds = await store.getDeviceIds('foo');
      assert.sameMembers(deviceIds, []);
    });
  });

  describe('getOpenDevices', () => {
    it('returns all open devices for a number', async () => {
      const openRecord = getSessionRecord(true);
      const openDevices = [1, 2, 3, 10].map(deviceId => {
        return [number, deviceId].join('.');
      });
      await Promise.all(
        openDevices.map(async encodedNumber => {
          await store.storeSession(encodedNumber, openRecord);
        })
      );

      const closedRecord = getSessionRecord(false);
      await store.storeSession([number, 11].join('.'), closedRecord);

      const result = await store.getOpenDevices([number, 'blah', 'blah2']);
      assert.deepEqual(result, {
        devices: [
          {
            id: 1,
            identifier: number,
          },
          {
            id: 2,
            identifier: number,
          },
          {
            id: 3,
            identifier: number,
          },
          {
            id: 10,
            identifier: number,
          },
        ],
        emptyIdentifiers: ['blah', 'blah2'],
      });
    });

    it('returns empty array for a number with no device ids', async () => {
      const result = await store.getOpenDevices(['foo']);
      assert.deepEqual(result, {
        devices: [],
        emptyIdentifiers: ['foo'],
      });
    });
  });

  describe('zones', () => {
    const zone = new Zone('zone', {
      pendingSessions: true,
      pendingUnprocessed: true,
    });

    beforeEach(async () => {
      await store.removeAllUnprocessed();
      await store.removeAllSessions(number);
    });

    it('should not store pending sessions in global zone', async () => {
      const id = `${number}.1`;
      const testRecord = getSessionRecord();

      await assert.isRejected(
        store.withZone(GLOBAL_ZONE, 'test', async () => {
          await store.storeSession(id, testRecord);
          throw new Error('Failure');
        }),
        'Failure'
      );

      assert.equal(await store.loadSession(id), testRecord);
    });

    it('commits session stores and unprocessed on success', async () => {
      const id = `${number}.1`;
      const testRecord = getSessionRecord();

      await store.withZone(zone, 'test', async () => {
        await store.storeSession(id, testRecord, { zone });

        await store.addUnprocessed(
          {
            id: '2-two',
            envelope: 'second',
            timestamp: 2,
            version: 2,
            attempts: 0,
          },
          { zone }
        );
        assert.equal(await store.loadSession(id, { zone }), testRecord);
      });

      assert.equal(await store.loadSession(id), testRecord);

      const allUnprocessed = await store.getAllUnprocessed();
      assert.deepEqual(
        allUnprocessed.map(({ envelope }) => envelope),
        ['second']
      );
    });

    it('reverts session stores and unprocessed on error', async () => {
      const id = `${number}.1`;
      const testRecord = getSessionRecord();
      const failedRecord = getSessionRecord();

      await store.storeSession(id, testRecord);
      assert.equal(await store.loadSession(id), testRecord);

      await assert.isRejected(
        store.withZone(zone, 'test', async () => {
          await store.storeSession(id, failedRecord, { zone });
          assert.equal(await store.loadSession(id, { zone }), failedRecord);

          await store.addUnprocessed(
            {
              id: '2-two',
              envelope: 'second',
              timestamp: 2,
              version: 2,
              attempts: 0,
            },
            { zone }
          );

          throw new Error('Failure');
        }),
        'Failure'
      );

      assert.equal(await store.loadSession(id), testRecord);
      assert.deepEqual(await store.getAllUnprocessed(), []);
    });

    it('can be re-entered', async () => {
      const id = `${number}.1`;
      const testRecord = getSessionRecord();

      await store.withZone(zone, 'test', async () => {
        await store.withZone(zone, 'nested', async () => {
          await store.storeSession(id, testRecord, { zone });

          assert.equal(await store.loadSession(id, { zone }), testRecord);
        });

        assert.equal(await store.loadSession(id, { zone }), testRecord);
      });

      assert.equal(await store.loadSession(id), testRecord);
    });

    it('can be re-entered after waiting', async () => {
      const a = new Zone('a');
      const b = new Zone('b');

      const order: Array<number> = [];
      const promises: Array<Promise<unknown>> = [];

      // What happens below is briefly following:
      // 1. We enter zone "a"
      // 2. We wait for zone "a" to be left to enter zone "b"
      // 3. Skip few ticks to trigger leave of zone "a" and resolve the waiting
      //    queue promise for zone "b"
      // 4. Enter zone "a" while resolution was the promise above is queued in
      //    microtasks queue.

      promises.push(store.withZone(a, 'a', async () => order.push(1)));
      promises.push(store.withZone(b, 'b', async () => order.push(2)));
      await Promise.resolve();
      await Promise.resolve();
      promises.push(store.withZone(a, 'a again', async () => order.push(3)));

      await Promise.all(promises);

      assert.deepEqual(order, [1, 2, 3]);
    });

    it('should not deadlock in archiveSiblingSessions', async () => {
      const id = `${number}.1`;
      const sibling = `${number}.2`;

      await store.storeSession(id, getSessionRecord(true));
      await store.storeSession(sibling, getSessionRecord(true));

      await store.archiveSiblingSessions(id, { zone });
    });
  });

  describe('Not yet processed messages', () => {
    beforeEach(async () => {
      await store.removeAllUnprocessed();
      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 0);
    });

    it('adds three and gets them back', async () => {
      await Promise.all([
        store.addUnprocessed({
          id: '2-two',
          envelope: 'second',
          timestamp: 2,
          version: 2,
          attempts: 0,
        }),
        store.addUnprocessed({
          id: '3-three',
          envelope: 'third',
          timestamp: 3,
          version: 2,
          attempts: 0,
        }),
        store.addUnprocessed({
          id: '1-one',
          envelope: 'first',
          timestamp: 1,
          version: 2,
          attempts: 0,
        }),
      ]);

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 3);

      // they are in the proper order because the collection comparator is 'timestamp'
      assert.strictEqual(items[0].envelope, 'first');
      assert.strictEqual(items[1].envelope, 'second');
      assert.strictEqual(items[2].envelope, 'third');
    });

    it('can updates items', async () => {
      const id = '1-one';
      await store.addUnprocessed({
        id,
        envelope: 'first',
        timestamp: 1,
        version: 2,
        attempts: 0,
      });
      await store.updateUnprocessedWithData(id, { decrypted: 'updated' });

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 1);
      assert.strictEqual(items[0].decrypted, 'updated');
      assert.strictEqual(items[0].timestamp, 1);
    });

    it('removeUnprocessed successfully deletes item', async () => {
      const id = '1-one';
      await store.addUnprocessed({
        id,
        envelope: 'first',
        timestamp: 1,
        version: 2,
        attempts: 0,
      });
      await store.removeUnprocessed(id);

      const items = await store.getAllUnprocessed();
      assert.strictEqual(items.length, 0);
    });
  });
});
