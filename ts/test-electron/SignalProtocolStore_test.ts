// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */

import { assert } from 'chai';
import { clone } from 'lodash';
import {
  Direction,
  IdentityKeyPair,
  PrivateKey,
  PublicKey,
  SenderKeyRecord,
  SessionRecord,
  SignedPreKeyRecord,
} from '@signalapp/libsignal-client';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../sql/Client';
import { signal } from '../protobuf/compiled';
import { sessionStructureToBytes } from '../util/sessionTranslation';
import * as durations from '../util/durations';
import { explodePromise } from '../util/explodePromise';
import { Zone } from '../util/Zone';

import * as Bytes from '../Bytes';
import { getRandomBytes, constantTimeEqual } from '../Crypto';
import {
  clampPrivateKey,
  setPublicKeyTypeByte,
  generateSignedPreKey,
} from '../Curve';
import type { SignalProtocolStore } from '../SignalProtocolStore';
import { GLOBAL_ZONE } from '../SignalProtocolStore';
import { Address } from '../types/Address';
import { QualifiedAddress } from '../types/QualifiedAddress';
import { generateAci, generatePni } from '../types/ServiceId';
import type { IdentityKeyType, KeyPairType } from '../textsecure/Types.d';

const {
  RecordStructure,
  SessionStructure,
  SenderKeyRecordStructure,
  SenderKeyStateStructure,
} = signal.proto.storage;

const ZERO = new Uint8Array(0);

describe('SignalProtocolStore', () => {
  const ourAci = generateAci();
  const ourPni = generatePni();
  const theirAci = generateAci();
  let store: SignalProtocolStore;
  let identityKey: KeyPairType;
  let testKey: KeyPairType;

  const NOW = Date.now();

  const unprocessedDefaults = {
    type: 1,
    messageAgeSec: 1,
    source: undefined,
    sourceDevice: undefined,
    sourceServiceId: undefined,
    destinationServiceId: ourAci,
    reportingToken: undefined,
    groupId: undefined,
    updatedPni: undefined,
    story: false,
    urgent: false,
    receivedAtCounter: 0,
    serverGuid: generateUuid(),
    serverTimestamp: 1,
    attempts: 0,

    isEncrypted: true,
    content: Buffer.from('content'),
    timestamp: NOW,
  };

  function getSessionRecord(isOpen?: boolean): SessionRecord {
    const proto = new RecordStructure();

    proto.previousSessions = [];

    if (isOpen) {
      proto.currentSession = new SessionStructure();

      proto.currentSession.aliceBaseKey = getPublicKey();
      proto.currentSession.localIdentityPublic = getPublicKey();
      proto.currentSession.localRegistrationId = 435;

      proto.currentSession.previousCounter = 1;
      proto.currentSession.remoteIdentityPublic = getPublicKey();
      proto.currentSession.remoteRegistrationId = 243;

      proto.currentSession.rootKey = getPrivateKey();
      proto.currentSession.sessionVersion = 3;
      proto.currentSession.senderChain = {};
    }

    return SessionRecord.deserialize(
      Buffer.from(sessionStructureToBytes(proto))
    );
  }

  function getSenderKeyRecord(): SenderKeyRecord {
    const proto = new SenderKeyRecordStructure();

    const state = new SenderKeyStateStructure();

    state.senderKeyId = 4;

    const senderChainKey = new SenderKeyStateStructure.SenderChainKey();

    senderChainKey.iteration = 10;
    senderChainKey.seed = getPublicKey();
    state.senderChainKey = senderChainKey;

    const senderSigningKey = new SenderKeyStateStructure.SenderSigningKey();
    senderSigningKey.public = getPublicKey();
    senderSigningKey.private = getPrivateKey();

    state.senderSigningKey = senderSigningKey;

    state.senderMessageKeys = [];
    const messageKey = new SenderKeyStateStructure.SenderMessageKey();
    messageKey.iteration = 234;
    messageKey.seed = getPublicKey();
    state.senderMessageKeys.push(messageKey);

    proto.senderKeyStates = [];
    proto.senderKeyStates.push(state);

    return SenderKeyRecord.deserialize(
      Buffer.from(
        signal.proto.storage.SenderKeyRecordStructure.encode(proto).finish()
      )
    );
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
    await store.hydrateCaches();
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

    await window.storage.put('registrationIdMap', {
      [ourAci]: 1337,
    });
    await window.storage.put('identityKeyMap', {
      [ourAci]: {
        privKey: identityKey.privKey,
        pubKey: identityKey.pubKey,
      },
    });
    await window.storage.fetch();

    window.ConversationController.reset();
    await window.ConversationController.load();
    await window.ConversationController.getOrCreateAndWait(theirAci, 'private');
  });

  describe('getLocalRegistrationId', () => {
    it('retrieves my registration id', async () => {
      await store.hydrateCaches();
      const id = await store.getLocalRegistrationId(ourAci);
      assert.strictEqual(id, 1337);
    });
  });
  describe('getIdentityKeyPair', () => {
    it('retrieves my identity key', async () => {
      await store.hydrateCaches();
      const key = store.getIdentityKeyPair(ourAci);
      if (!key) {
        throw new Error('Missing key!');
      }

      assert.isTrue(constantTimeEqual(key.pubKey, identityKey.pubKey));
      assert.isTrue(constantTimeEqual(key.privKey, identityKey.privKey));
    });
  });

  describe('senderKeys', () => {
    it('roundtrips in memory', async () => {
      const distributionId = generateUuid();
      const expected = getSenderKeyRecord();

      const deviceId = 1;
      const qualifiedAddress = new QualifiedAddress(
        ourAci,
        new Address(theirAci, deviceId)
      );

      await store.saveSenderKey(qualifiedAddress, distributionId, expected);

      const actual = await store.getSenderKey(qualifiedAddress, distributionId);
      if (!actual) {
        throw new Error('getSenderKey returned nothing!');
      }

      assert.isTrue(
        constantTimeEqual(expected.serialize(), actual.serialize())
      );

      await store.removeSenderKey(qualifiedAddress, distributionId);

      const postDeleteGet = await store.getSenderKey(
        qualifiedAddress,
        distributionId
      );
      assert.isUndefined(postDeleteGet);
    });

    it('roundtrips through database', async () => {
      const distributionId = generateUuid();
      const expected = getSenderKeyRecord();

      const deviceId = 1;
      const qualifiedAddress = new QualifiedAddress(
        ourAci,
        new Address(theirAci, deviceId)
      );

      await store.saveSenderKey(qualifiedAddress, distributionId, expected);

      // Re-fetch from the database to ensure we get the latest database value
      await store.hydrateCaches();

      const actual = await store.getSenderKey(qualifiedAddress, distributionId);
      if (!actual) {
        throw new Error('getSenderKey returned nothing!');
      }

      assert.isTrue(
        constantTimeEqual(expected.serialize(), actual.serialize())
      );

      await store.removeSenderKey(qualifiedAddress, distributionId);

      // Re-fetch from the database to ensure we get the latest database value
      await store.hydrateCaches();

      const postDeleteGet = await store.getSenderKey(
        qualifiedAddress,
        distributionId
      );
      assert.isUndefined(postDeleteGet);
    });
  });

  describe('saveIdentity', () => {
    const identifier = new Address(theirAci, 1);

    it('stores identity keys', async () => {
      await store.saveIdentity(identifier, testKey.pubKey);
      const key = await store.loadIdentityKey(theirAci);
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
    it('should not deadlock', async () => {
      const newIdentity = getPublicKey();
      const zone = new Zone('zone', {
        pendingSenderKeys: true,
        pendingSessions: true,
        pendingUnprocessed: true,
      });

      await store.saveIdentity(identifier, testKey.pubKey);

      const { promise, resolve } = explodePromise<void>();

      await Promise.all([
        store.withZone(zone, 'test', async () => {
          await promise;
          return store.saveIdentity(identifier, newIdentity, false, { zone });
        }),
        store.saveIdentity(identifier, newIdentity, false, {
          zone: GLOBAL_ZONE,
        }),
        resolve(),
      ]);
    });

    describe('When there is no existing key (first use)', () => {
      before(async () => {
        await store.removeIdentityKey(theirAci);
        await store.saveIdentity(identifier, testKey.pubKey);
      });
      it('marks the key firstUse', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert(identity.firstUse);
      });
      it('sets the timestamp', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert(identity.timestamp);
      });
      it('sets the verified status to DEFAULT', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
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
        await DataWriter.createOrUpdateIdentityKey({
          id: theirAci,
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
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert(!identity.firstUse);
      });
      it('updates the timestamp', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.notEqual(identity.timestamp, oldTimestamp);
      });

      describe('The previous verified status was DEFAULT', () => {
        before(async () => {
          await DataWriter.createOrUpdateIdentityKey({
            id: theirAci,
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
          const identity = await DataReader.getIdentityKeyById(theirAci);
          if (!identity) {
            throw new Error('Missing identity!');
          }
          assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
        });
      });
      describe('The previous verified status was VERIFIED', () => {
        before(async () => {
          await DataWriter.createOrUpdateIdentityKey({
            id: theirAci,
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
          const identity = await DataReader.getIdentityKeyById(theirAci);
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
          await DataWriter.createOrUpdateIdentityKey({
            id: theirAci,
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
          const identity = await DataReader.getIdentityKeyById(theirAci);
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
        await DataWriter.createOrUpdateIdentityKey({
          id: theirAci,
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
          const identity = await DataReader.getIdentityKeyById(theirAci);
          if (!identity) {
            throw new Error('Missing identity!');
          }
          identity.firstUse = true;
          await DataWriter.createOrUpdateIdentityKey(identity);
          await store.hydrateCaches();
        });
        it('nothing changes', async () => {
          await store.saveIdentity(identifier, testKey.pubKey, true);

          const identity = await DataReader.getIdentityKeyById(theirAci);
          if (!identity) {
            throw new Error('Missing identity!');
          }
          assert(!identity.nonblockingApproval);
          assert.strictEqual(identity.timestamp, oldTimestamp);
        });
      });
      describe('If it is not marked firstUse', () => {
        before(async () => {
          const identity = await DataReader.getIdentityKeyById(theirAci);
          if (!identity) {
            throw new Error('Missing identity!');
          }
          identity.firstUse = false;
          await DataWriter.createOrUpdateIdentityKey(identity);
          await store.hydrateCaches();
        });
        describe('If nonblocking approval is required', () => {
          let now: number;
          before(async () => {
            now = Date.now();
            const identity = await DataReader.getIdentityKeyById(theirAci);
            if (!identity) {
              throw new Error('Missing identity!');
            }
            identity.timestamp = now;
            await DataWriter.createOrUpdateIdentityKey(identity);
            await store.hydrateCaches();
          });
          it('sets non-blocking approval', async () => {
            await store.saveIdentity(identifier, testKey.pubKey, true);

            const identity = await DataReader.getIdentityKeyById(theirAci);
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
        id: theirAci,
        publicKey: testKey.pubKey,
        firstUse: true,
        timestamp: now,
        verified: store.VerifiedStatus.VERIFIED,
        nonblockingApproval: false,
      };

      await store.removeIdentityKey(theirAci);
    });
    describe('with valid attributes', () => {
      before(async () => {
        await store.saveIdentityWithAttributes(theirAci, validAttributes);
      });

      it('publicKey is saved', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.isTrue(constantTimeEqual(identity.publicKey, testKey.pubKey));
      });
      it('firstUse is saved', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.firstUse, true);
      });
      it('timestamp is saved', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.timestamp, now);
      });
      it('verified is saved', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
      });
      it('nonblockingApproval is saved', async () => {
        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }
        assert.strictEqual(identity.nonblockingApproval, false);
      });
    });
    describe('with invalid attributes', () => {
      let attributes: IdentityKeyType;
      beforeEach(() => {
        attributes = clone(validAttributes);
      });

      async function testInvalidAttributes() {
        try {
          await store.saveIdentityWithAttributes(theirAci, attributes);
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
      await store.setApproval(theirAci, true);
      const identity = await DataReader.getIdentityKeyById(theirAci);
      if (!identity) {
        throw new Error('Missing identity!');
      }

      assert.strictEqual(identity.nonblockingApproval, true);
    });
  });
  describe('setVerified', () => {
    async function saveRecordDefault() {
      await DataWriter.createOrUpdateIdentityKey({
        id: theirAci,
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
        await store.setVerified(theirAci, store.VerifiedStatus.VERIFIED);

        const identity = await DataReader.getIdentityKeyById(theirAci);
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
        await store.setVerified(theirAci, store.VerifiedStatus.VERIFIED);

        const identity = await DataReader.getIdentityKeyById(theirAci);
        if (!identity) {
          throw new Error('Missing identity!');
        }

        assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
        assert.isTrue(constantTimeEqual(identity.publicKey, testKey.pubKey));
      });
    });
  });

  describe('updateIdentityAfterSync', () => {
    const newIdentity = getPublicKey();
    let keychangeTriggered: number;

    beforeEach(async () => {
      keychangeTriggered = 0;
      store.on('keychange', () => {
        keychangeTriggered += 1;
      });

      await DataWriter.createOrUpdateIdentityKey({
        id: theirAci,
        publicKey: testKey.pubKey,
        timestamp: Date.now() - 10 * 1000 * 60,
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: false,
      });
      await store.hydrateCaches();
    });

    afterEach(() => {
      store.removeAllListeners('keychange');
    });

    it('should create an identity and set verified to DEFAULT', async () => {
      const newAci = generateAci();

      const needsNotification = await store.updateIdentityAfterSync(
        newAci,
        store.VerifiedStatus.DEFAULT,
        newIdentity
      );
      assert.isFalse(needsNotification);
      assert.strictEqual(keychangeTriggered, 0);

      const identity = await DataReader.getIdentityKeyById(newAci);
      if (!identity) {
        throw new Error('Missing identity!');
      }
      assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
      assert.isTrue(constantTimeEqual(identity.publicKey, newIdentity));
    });

    it('should create an identity and set verified to VERIFIED', async () => {
      const newAci = generateAci();

      const needsNotification = await store.updateIdentityAfterSync(
        newAci,
        store.VerifiedStatus.VERIFIED,
        newIdentity
      );
      assert.isTrue(needsNotification);
      assert.strictEqual(keychangeTriggered, 0);

      const identity = await DataReader.getIdentityKeyById(newAci);
      if (!identity) {
        throw new Error('Missing identity!');
      }
      assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
      assert.isTrue(constantTimeEqual(identity.publicKey, newIdentity));
    });

    it('should update public key without verified change', async () => {
      const needsNotification = await store.updateIdentityAfterSync(
        theirAci,
        store.VerifiedStatus.DEFAULT,
        newIdentity
      );
      assert.isFalse(needsNotification);
      assert.strictEqual(keychangeTriggered, 1);

      const identity = await DataReader.getIdentityKeyById(theirAci);
      if (!identity) {
        throw new Error('Missing identity!');
      }
      assert.strictEqual(identity.verified, store.VerifiedStatus.DEFAULT);
      assert.isTrue(constantTimeEqual(identity.publicKey, newIdentity));
    });

    it('should update verified without public key change', async () => {
      const needsNotification = await store.updateIdentityAfterSync(
        theirAci,
        store.VerifiedStatus.VERIFIED,
        testKey.pubKey
      );
      assert.isTrue(needsNotification);
      assert.strictEqual(keychangeTriggered, 0);

      const identity = await DataReader.getIdentityKeyById(theirAci);
      if (!identity) {
        throw new Error('Missing identity!');
      }
      assert.strictEqual(identity.verified, store.VerifiedStatus.VERIFIED);
      assert.isTrue(constantTimeEqual(identity.publicKey, testKey.pubKey));
    });
  });

  describe('isUntrusted', () => {
    it('returns false if identity key old enough', async () => {
      await DataWriter.createOrUpdateIdentityKey({
        id: theirAci,
        publicKey: testKey.pubKey,
        timestamp: Date.now() - 10 * 1000 * 60,
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: false,
      });

      await store.hydrateCaches();
      const untrusted = await store.isUntrusted(theirAci);
      assert.strictEqual(untrusted, false);
    });

    it('returns false if new but nonblockingApproval is true', async () => {
      await DataWriter.createOrUpdateIdentityKey({
        id: theirAci,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: true,
      });
      await store.hydrateCaches();

      const untrusted = await store.isUntrusted(theirAci);
      assert.strictEqual(untrusted, false);
    });

    it('returns false if new but firstUse is true', async () => {
      await DataWriter.createOrUpdateIdentityKey({
        id: theirAci,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: true,
        nonblockingApproval: false,
      });
      await store.hydrateCaches();

      const untrusted = await store.isUntrusted(theirAci);
      assert.strictEqual(untrusted, false);
    });

    it('returns true if new, and no flags are set', async () => {
      await DataWriter.createOrUpdateIdentityKey({
        id: theirAci,
        publicKey: testKey.pubKey,
        timestamp: Date.now(),
        verified: store.VerifiedStatus.DEFAULT,
        firstUse: false,
        nonblockingApproval: false,
      });
      await store.hydrateCaches();

      const untrusted = await store.isUntrusted(theirAci);
      assert.strictEqual(untrusted, true);
    });
  });

  describe('getVerified', () => {
    before(async () => {
      await store.setVerified(theirAci, store.VerifiedStatus.VERIFIED);
    });
    it('resolves to the verified status', async () => {
      const result = await store.getVerified(theirAci);
      assert.strictEqual(result, store.VerifiedStatus.VERIFIED);
    });
  });
  describe('isTrustedIdentity', () => {
    const identifier = new Address(theirAci, 1);

    describe('When invalid direction is given', () => {
      it('should fail', async () => {
        await assert.isRejected(
          store.isTrustedIdentity(identifier, testKey.pubKey, 'dir' as any)
        );
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
          await store.removeIdentityKey(theirAci);
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
      await store.storePreKeys(ourAci, [{ keyId: 1, keyPair: testKey }]);
      const key = await store.loadPreKey(ourAci, 1);
      if (!key) {
        throw new Error('Missing key!');
      }

      const keyPair = {
        pubKey: key.publicKey().serialize(),
        privKey: key.privateKey().serialize(),
      };

      assert.isTrue(constantTimeEqual(keyPair.pubKey, testKey.pubKey));
      assert.isTrue(constantTimeEqual(keyPair.privKey, testKey.privKey));
    });
  });
  describe('removePreKey', () => {
    before(async () => {
      await store.storePreKeys(ourAci, [{ keyId: 2, keyPair: testKey }]);
    });
    it('deletes prekeys', async () => {
      await store.removePreKeys(ourAci, [2]);

      const key = await store.loadPreKey(ourAci, 2);
      assert.isUndefined(key);
    });
  });
  describe('storeSignedPreKey', () => {
    it('stores signed prekeys', async () => {
      await store.storeSignedPreKey(ourAci, 3, testKey);
      const key = await store.loadSignedPreKey(ourAci, 3);
      if (!key) {
        throw new Error('Missing key!');
      }

      const keyPair = {
        pubKey: key.publicKey().serialize(),
        privKey: key.privateKey().serialize(),
      };

      assert.isTrue(constantTimeEqual(keyPair.pubKey, testKey.pubKey));
      assert.isTrue(constantTimeEqual(keyPair.privKey, testKey.privKey));
    });
  });
  describe('removeSignedPreKey', () => {
    before(async () => {
      await store.storeSignedPreKey(ourAci, 4, testKey);
    });
    it('deletes signed prekeys', async () => {
      await store.removeSignedPreKeys(ourAci, [4]);

      const key = await store.loadSignedPreKey(ourAci, 4);
      assert.isUndefined(key);
    });
  });
  describe('storeSession', () => {
    it('stores sessions', async () => {
      const testRecord = getSessionRecord();
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
      await store.storeSession(id, testRecord);
      const record = await store.loadSession(id);
      if (!record) {
        throw new Error('Missing record!');
      }

      assert.equal(record, testRecord);
    });
  });
  describe('removeSessionsByServiceId', () => {
    it('removes all sessions for a uuid', async () => {
      const devices = [1, 2, 3].map(
        deviceId =>
          new QualifiedAddress(ourAci, new Address(theirAci, deviceId))
      );

      await Promise.all(
        devices.map(async encodedAddress => {
          await store.storeSession(encodedAddress, getSessionRecord());
        })
      );

      const records0 = await Promise.all(
        devices.map(device => store.loadSession(device))
      );
      for (let i = 0, max = records0.length; i < max; i += 1) {
        assert.exists(records0[i], 'before delete');
      }

      await store.removeSessionsByServiceId(theirAci);

      const records = await Promise.all(
        devices.map(device => store.loadSession(device))
      );
      for (let i = 0, max = records.length; i < max; i += 1) {
        assert.isUndefined(records[i], 'in-memory');
      }

      await store.hydrateCaches();

      const records2 = await Promise.all(
        devices.map(device => store.loadSession(device))
      );
      for (let i = 0, max = records2.length; i < max; i += 1) {
        assert.isUndefined(records2[i], 'from database');
      }
    });
  });
  describe('removeSessionsByConversation', () => {
    it('removes all sessions for a uuid', async () => {
      const devices = [1, 2, 3].map(
        deviceId =>
          new QualifiedAddress(ourAci, new Address(theirAci, deviceId))
      );
      const conversationId = window.ConversationController.getOrCreate(
        theirAci,
        'private'
      ).id;

      await Promise.all(
        devices.map(async encodedAddress => {
          await store.storeSession(encodedAddress, getSessionRecord());
        })
      );

      const records0 = await Promise.all(
        devices.map(device => store.loadSession(device))
      );
      for (let i = 0, max = records0.length; i < max; i += 1) {
        assert.exists(records0[i], 'before delete');
      }

      await store.removeSessionsByConversation(conversationId);

      const records = await Promise.all(
        devices.map(device => store.loadSession(device))
      );
      for (let i = 0, max = records.length; i < max; i += 1) {
        assert.isUndefined(records[i], 'in-memory');
      }

      await store.hydrateCaches();

      const records2 = await Promise.all(
        devices.map(device => store.loadSession(device))
      );
      for (let i = 0, max = records2.length; i < max; i += 1) {
        assert.isUndefined(records[i], 'from database');
      }
    });
  });
  describe('clearSessionStore', () => {
    it('clears the session store', async () => {
      const testRecord = getSessionRecord();
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
      await store.storeSession(id, testRecord);
      await store.clearSessionStore();

      const record = await store.loadSession(id);
      assert.isUndefined(record);
    });
  });
  describe('getDeviceIds', () => {
    it('returns deviceIds for a uuid', async () => {
      const openRecord = getSessionRecord(true);
      const openDevices = [1, 2, 3, 10].map(
        deviceId =>
          new QualifiedAddress(ourAci, new Address(theirAci, deviceId))
      );
      await Promise.all(
        openDevices.map(async address => {
          await store.storeSession(address, openRecord);
        })
      );

      const closedRecord = getSessionRecord(false);
      await store.storeSession(
        new QualifiedAddress(ourAci, new Address(theirAci, 11)),
        closedRecord
      );

      const deviceIds = await store.getDeviceIds({
        ourServiceId: ourAci,
        serviceId: theirAci,
      });
      assert.sameMembers(deviceIds, [1, 2, 3, 10]);
    });

    it('returns empty array for a uuid with no device ids', async () => {
      const foo = generateAci();
      const deviceIds = await store.getDeviceIds({
        ourServiceId: ourAci,
        serviceId: foo,
      });
      assert.sameMembers(deviceIds, []);
    });
  });

  describe('getOpenDevices', () => {
    it('returns all open devices for a uuid', async () => {
      const openRecord = getSessionRecord(true);
      const openDevices = [1, 2, 3, 10].map(
        deviceId =>
          new QualifiedAddress(ourAci, new Address(theirAci, deviceId))
      );
      await Promise.all(
        openDevices.map(async address => {
          await store.storeSession(address, openRecord);
        })
      );

      const closedRecord = getSessionRecord(false);
      await store.storeSession(
        new QualifiedAddress(ourAci, new Address(theirAci, 11)),
        closedRecord
      );

      const blah = generateAci();
      const blah2 = generateAci();

      const result = await store.getOpenDevices(ourAci, [
        theirAci,
        blah,
        blah2,
      ]);
      assert.deepStrictEqual(
        {
          ...result,
          devices: result.devices.map(({ id, serviceId, registrationId }) => ({
            id,
            serviceId,
            registrationId,
          })),
        },
        {
          devices: [
            {
              id: 1,
              serviceId: theirAci,
              registrationId: 243,
            },
            {
              id: 2,
              serviceId: theirAci,
              registrationId: 243,
            },
            {
              id: 3,
              serviceId: theirAci,
              registrationId: 243,
            },
            {
              id: 10,
              serviceId: theirAci,
              registrationId: 243,
            },
          ],
          emptyServiceIds: [blah, blah2],
        }
      );
    });

    it('returns empty array for a uuid with no device ids', async () => {
      const foo = generateAci();
      const result = await store.getOpenDevices(ourAci, [foo]);
      assert.deepEqual(result, {
        devices: [],
        emptyServiceIds: [foo],
      });
    });
  });

  describe('zones', () => {
    const distributionId = generateUuid();
    const zone = new Zone('zone', {
      pendingSenderKeys: true,
      pendingSessions: true,
      pendingUnprocessed: true,
    });

    beforeEach(async () => {
      await store.removeAllUnprocessed();
      await store.removeSessionsByServiceId(theirAci);
      await store.removeAllSenderKeys();
    });

    it('should not store pending sessions in global zone', async () => {
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
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

    it('should not store pending sender keys in global zone', async () => {
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
      const testRecord = getSenderKeyRecord();

      await assert.isRejected(
        store.withZone(GLOBAL_ZONE, 'test', async () => {
          await store.saveSenderKey(id, distributionId, testRecord);
          throw new Error('Failure');
        }),
        'Failure'
      );

      assert.equal(await store.getSenderKey(id, distributionId), testRecord);
    });

    it('commits sender keys, sessions and unprocessed on success', async () => {
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
      const testSession = getSessionRecord();
      const testSenderKey = getSenderKeyRecord();

      await store.withZone(zone, 'test', async () => {
        await store.storeSession(id, testSession, { zone });
        await store.saveSenderKey(id, distributionId, testSenderKey, { zone });

        await store.addUnprocessed(
          {
            ...unprocessedDefaults,
            id: '2-two',

            content: Buffer.from('second'),
            receivedAtDate: Date.now() + 2,
          },
          { zone }
        );

        assert.equal(await store.loadSession(id, { zone }), testSession);
        assert.equal(
          await store.getSenderKey(id, distributionId, { zone }),
          testSenderKey
        );
      });

      assert.equal(await store.loadSession(id), testSession);
      assert.equal(await store.getSenderKey(id, distributionId), testSenderKey);

      const allUnprocessed =
        await store.getUnprocessedByIdsAndIncrementAttempts(
          await store.getAllUnprocessedIds()
        );

      assert.deepEqual(
        allUnprocessed.map(({ content }) => Bytes.toString(content || ZERO)),
        ['second']
      );
    });

    it('reverts sender keys, sessions and unprocessed on error', async () => {
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
      const testSession = getSessionRecord();
      const failedSession = getSessionRecord();
      const testSenderKey = getSenderKeyRecord();
      const failedSenderKey = getSenderKeyRecord();

      await store.storeSession(id, testSession);
      assert.equal(await store.loadSession(id), testSession);

      await store.saveSenderKey(id, distributionId, testSenderKey);
      assert.equal(await store.getSenderKey(id, distributionId), testSenderKey);

      await assert.isRejected(
        store.withZone(zone, 'test', async () => {
          await store.storeSession(id, failedSession, { zone });
          assert.equal(await store.loadSession(id, { zone }), failedSession);

          await store.saveSenderKey(id, distributionId, failedSenderKey, {
            zone,
          });
          assert.equal(
            await store.getSenderKey(id, distributionId, { zone }),
            failedSenderKey
          );

          await store.addUnprocessed(
            {
              ...unprocessedDefaults,
              id: '2-two',

              content: Buffer.from('second'),
              receivedAtDate: 2,
            },
            { zone }
          );

          throw new Error('Failure');
        }),
        'Failure'
      );

      assert.equal(await store.loadSession(id), testSession);
      assert.equal(await store.getSenderKey(id, distributionId), testSenderKey);
      assert.deepEqual(
        await store.getUnprocessedByIdsAndIncrementAttempts(
          await store.getAllUnprocessedIds()
        ),
        []
      );
    });

    it('can be re-entered', async () => {
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
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
      const id = new QualifiedAddress(ourAci, new Address(theirAci, 1));
      const sibling = new QualifiedAddress(ourAci, new Address(theirAci, 2));

      await store.storeSession(id, getSessionRecord(true));
      await store.storeSession(sibling, getSessionRecord(true));

      await store.archiveSiblingSessions(id.address, { zone });
    });

    it('should not throw in archiveSession on PNI', async () => {
      const id = new QualifiedAddress(ourPni, new Address(theirAci, 1));

      await store.storeSession(id, getSessionRecord(true));

      await store.archiveSession(id);

      const { devices, emptyServiceIds } = await store.getOpenDevices(ourPni, [
        theirAci,
      ]);

      assert.deepEqual(devices, []);
      assert.deepEqual(emptyServiceIds, [theirAci]);
    });

    it('can be concurrently re-entered after waiting', async () => {
      const a = new Zone('a');
      const b = new Zone('b');

      const order: Array<number> = [];
      const promises: Array<Promise<unknown>> = [];

      // 1. Enter zone "a"
      // 2. Wait for zone "a" to be left to enter zone "b" twice
      // 3. Verify that both zone "b" tasks ran in parallel

      promises.push(store.withZone(a, 'a', async () => order.push(1)));
      promises.push(
        store.withZone(b, 'b', async () => {
          order.push(2);
          await Promise.resolve();
          order.push(22);
        })
      );
      promises.push(
        store.withZone(b, 'b', async () => {
          order.push(3);
          await Promise.resolve();
          order.push(33);
        })
      );
      await Promise.resolve();
      await Promise.resolve();

      await Promise.all(promises);

      assert.deepEqual(order, [1, 2, 3, 22, 33]);
    });
  });

  describe('Not yet processed messages', () => {
    beforeEach(async () => {
      await store.removeAllUnprocessed();
      const items = await store.getUnprocessedByIdsAndIncrementAttempts(
        await store.getAllUnprocessedIds()
      );
      assert.strictEqual(items.length, 0);
    });

    it('adds three and gets them back', async () => {
      await Promise.all([
        store.addUnprocessed({
          ...unprocessedDefaults,
          id: '0-dropped',

          content: Buffer.from('old envelope'),
          receivedAtCounter: -1,
          receivedAtDate: NOW - 2 * durations.MONTH,
        }),
        store.addUnprocessed({
          ...unprocessedDefaults,
          id: '2-two',

          content: Buffer.from('second'),
          receivedAtCounter: 1,
          receivedAtDate: NOW + 2,
        }),
        store.addUnprocessed({
          ...unprocessedDefaults,
          id: '3-three',

          content: Buffer.from('third'),
          receivedAtCounter: 2,
          receivedAtDate: NOW + 3,
        }),
        store.addUnprocessed({
          ...unprocessedDefaults,
          id: '1-one',

          content: Buffer.from('first'),
          receivedAtCounter: 0,
          receivedAtDate: NOW + 1,
        }),
      ]);

      const items = await store.getUnprocessedByIdsAndIncrementAttempts(
        await store.getAllUnprocessedIds()
      );
      assert.strictEqual(items.length, 3);

      // they are in the proper order because the collection comparator is
      // 'receivedAtCounter'
      assert.strictEqual(Bytes.toString(items[0].content || ZERO), 'first');
      assert.strictEqual(Bytes.toString(items[1].content || ZERO), 'second');
      assert.strictEqual(Bytes.toString(items[2].content || ZERO), 'third');
    });

    it('removeUnprocessed successfully deletes item', async () => {
      const id = '1-one';
      await store.addUnprocessed({
        ...unprocessedDefaults,

        id,

        receivedAtDate: NOW + 1,
      });
      await store.removeUnprocessed(id);

      const items = await store.getUnprocessedByIdsAndIncrementAttempts(
        await store.getAllUnprocessedIds()
      );
      assert.strictEqual(items.length, 0);
    });

    it('getAllUnprocessedAndIncrementAttempts deletes items', async () => {
      await store.addUnprocessed({
        ...unprocessedDefaults,

        id: '1-one',

        attempts: 10,
        receivedAtDate: NOW + 1,
      });

      const items = await store.getUnprocessedByIdsAndIncrementAttempts(
        await store.getAllUnprocessedIds()
      );
      assert.strictEqual(items.length, 0);
    });
  });
  describe('removeOurOldPni/updateOurPniKeyMaterial', () => {
    const oldPni = generatePni();

    beforeEach(async () => {
      await store.storePreKeys(oldPni, [{ keyId: 2, keyPair: testKey }]);
      await store.storeSignedPreKey(oldPni, 3, testKey);
    });

    it('removes old data and sets new', async () => {
      const newPni = generatePni();

      const newIdentity = IdentityKeyPair.generate();

      const data = generateSignedPreKey(
        {
          pubKey: newIdentity.publicKey.serialize(),
          privKey: newIdentity.privateKey.serialize(),
        },
        8201
      );
      const createdAt = Date.now() - 1241;
      const signedPreKey = SignedPreKeyRecord.new(
        data.keyId,
        createdAt,
        PublicKey.deserialize(Buffer.from(data.keyPair.pubKey)),
        PrivateKey.deserialize(Buffer.from(data.keyPair.privKey)),
        Buffer.from(data.signature)
      );

      await store.removeOurOldPni(oldPni);
      await store.updateOurPniKeyMaterial(newPni, {
        identityKeyPair: newIdentity.serialize(),
        signedPreKey: signedPreKey.serialize(),
        registrationId: 5231,
      });

      // Old data has to be removed
      assert.isUndefined(store.getIdentityKeyPair(oldPni));
      assert.isUndefined(await store.getLocalRegistrationId(oldPni));
      assert.isUndefined(await store.loadPreKey(oldPni, 2));
      assert.isUndefined(await store.loadSignedPreKey(oldPni, 3));

      // New data has to be added
      const storedIdentity = store.getIdentityKeyPair(newPni);
      if (!storedIdentity) {
        throw new Error('New identity not found');
      }
      assert.isTrue(
        Bytes.areEqual(
          storedIdentity.privKey,
          newIdentity.privateKey.serialize()
        )
      );
      assert.isTrue(
        Bytes.areEqual(storedIdentity.pubKey, newIdentity.publicKey.serialize())
      );

      const storedSignedPreKey = await store.loadSignedPreKey(newPni, 8201);
      if (!storedSignedPreKey) {
        throw new Error('New signed pre key not found');
      }
      assert.isTrue(
        Bytes.areEqual(
          storedSignedPreKey.publicKey().serialize(),
          data.keyPair.pubKey
        )
      );
      assert.isTrue(
        Bytes.areEqual(
          storedSignedPreKey.privateKey().serialize(),
          data.keyPair.privKey
        )
      );
      assert.strictEqual(storedSignedPreKey.timestamp(), createdAt);
      // Note: signature is ignored.
    });
  });
});
