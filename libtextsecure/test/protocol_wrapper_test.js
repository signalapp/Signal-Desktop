// Copyright 2016-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global libsignal, textsecure */

describe('Protocol Wrapper', function protocolWrapperDescribe() {
  const store = textsecure.storage.protocol;
  const identifier = '+15559999999';

  this.timeout(5000);

  before(async function thisNeeded() {
    localStorage.clear();
    this.identityKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
    await textsecure.storage.protocol.saveIdentity(
      identifier,
      this.identityKeyPair.pubKey
    );
  });

  describe('processPreKey', () => {
    beforeEach(function thisNeeded() {
      const address = new libsignal.SignalProtocolAddress(identifier, 1);
      this.builder = new libsignal.SessionBuilder(store, address);
    });

    it('can process prekeys', async function thisNeeded() {
      const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
        this.identityKeyPair,
        123
      );

      await this.builder.processPreKey({
        identityKey: this.identityKeyPair.pubKey,
        registrationId: 1,
        preKey: {
          keyId: 1,
          publicKey: this.identityKeyPair.pubKey,
        },
        signedPreKey: {
          keyId: 123,
          publicKey: signedPreKey.keyPair.pubKey,
          signature: signedPreKey.signature,
        },
      });
    });

    it('rejects if the identity key changes', function thisNeeded() {
      return this.builder
        .processPreKey({
          identityKey: textsecure.crypto.getRandomBytes(33),
        })
        .then(() => {
          throw new Error('Allowed to overwrite identity key');
        })
        .catch(e => {
          assert.strictEqual(e.message, 'Identity key changed');
        });
    });

    it('rejects with a bad prekey signature', async function thisNeeded() {
      const signedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
        this.identityKeyPair,
        123
      );
      const bogusSignature = textsecure.crypto.getRandomBytes(64);

      return this.builder
        .processPreKey({
          identityKey: this.identityKeyPair.pubKey,
          signedPreKey: {
            keyId: 123,
            publicKey: signedPreKey.keyPair.pubKey,
            signature: bogusSignature,
          },
        })
        .then(() => {
          throw new Error("Didn't reject an invalid signature");
        })
        .catch(e => {
          assert.strictEqual(e.message, 'Signature verification failed');
        });
    });

    it('rejects with a prekey signature for a different identity', async function thisNeeded() {
      const bogusSignedPreKey = await libsignal.KeyHelper.generateSignedPreKey(
        await libsignal.KeyHelper.generateIdentityKeyPair(),
        123
      );

      return this.builder
        .processPreKey({
          identityKey: this.identityKeyPair.pubKey,
          signedPreKey: {
            keyId: 123,
            publicKey: bogusSignedPreKey.keyPair.pubKey,
            signature: bogusSignedPreKey.signature,
          },
        })
        .then(() => {
          throw new Error("Didn't reject an invalid signature");
        })
        .catch(e => {
          assert.strictEqual(e.message, 'Signature verification failed');
        });
    });
  });
});
