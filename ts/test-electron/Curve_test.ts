// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Bytes from '../Bytes.std.js';
import { constantTimeEqual } from '../Crypto.node.js';
import {
  calculateSignature,
  clampPrivateKey,
  createKeyPair,
  calculateAgreement,
  generateKeyPair,
  generatePreKey,
  generateSignedPreKey,
  isNonNegativeInteger,
  verifySignature,
} from '../Curve.node.js';

describe('Curve', () => {
  it('verifySignature roundtrip', () => {
    const message = Buffer.from('message');
    const { publicKey, privateKey } = generateKeyPair();
    const signature = calculateSignature(privateKey, message);
    const verified = verifySignature(publicKey, message, signature);

    assert.isTrue(verified);
  });

  it('calculateAgreement roundtrip', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();

    const sharedSecretAlice = calculateAgreement(
      bob.publicKey,
      alice.privateKey
    );
    const sharedSecretBob = calculateAgreement(alice.publicKey, bob.privateKey);

    assert.isTrue(constantTimeEqual(sharedSecretAlice, sharedSecretBob));
  });

  describe('#isNonNegativeInteger', () => {
    it('returns false for -1, Infinity, NaN, a string, etc.', () => {
      assert.isFalse(isNonNegativeInteger(-1));
      assert.isFalse(isNonNegativeInteger(NaN));
      assert.isFalse(isNonNegativeInteger(Infinity));
      assert.isFalse(isNonNegativeInteger('woo!'));
    });
    it('returns true for 0 and positive integgers', () => {
      assert.isTrue(isNonNegativeInteger(0));
      assert.isTrue(isNonNegativeInteger(1));
      assert.isTrue(isNonNegativeInteger(3));
      assert.isTrue(isNonNegativeInteger(400_000));
    });
  });

  describe('#generateSignedPrekey', () => {
    it('geernates proper signature for created signed prekeys', () => {
      const keyId = 4;
      const identityKeyPair = generateKeyPair();
      const signedPreKey = generateSignedPreKey(identityKeyPair, keyId);

      assert.equal(keyId, signedPreKey.keyId);

      const verified = verifySignature(
        identityKeyPair.publicKey,
        signedPreKey.keyPair.publicKey.serialize(),
        signedPreKey.signature
      );

      assert.isTrue(verified);
    });
  });

  describe('#generatePrekey', () => {
    it('returns keys of the right length', () => {
      const keyId = 7;
      const preKey = generatePreKey(keyId);

      assert.equal(keyId, preKey.keyId);
      assert.equal(33, preKey.keyPair.publicKey.serialize().byteLength);
      assert.equal(32, preKey.keyPair.privateKey.serialize().byteLength);
    });
  });

  describe('#createKeyPair', () => {
    it('does not modify unclamped private key', () => {
      const initialHex =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const privateKey = Bytes.fromHex(initialHex);
      const copyOfPrivateKey = new Uint8Array(privateKey);

      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'initial copy check'
      );

      const keyPair = createKeyPair(privateKey);

      assert.equal(32, keyPair.privateKey.serialize().byteLength);
      assert.equal(33, keyPair.publicKey.serialize().byteLength);

      // The original incoming key is not modified
      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'second copy check'
      );

      // But the keypair that comes out has indeed been updated
      assert.notEqual(
        initialHex,
        Bytes.toHex(keyPair.privateKey.serialize()),
        'keypair check'
      );
      assert.isFalse(
        constantTimeEqual(keyPair.privateKey.serialize(), privateKey),
        'keypair vs incoming value'
      );
    });

    it('does not modify clamped private key', () => {
      const initialHex =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const privateKey = Bytes.fromHex(initialHex);
      clampPrivateKey(privateKey);
      const postClampHex = Bytes.toHex(privateKey);
      const copyOfPrivateKey = new Uint8Array(privateKey);

      assert.notEqual(postClampHex, initialHex, 'initial clamp check');
      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'initial copy check'
      );

      const keyPair = createKeyPair(privateKey);

      assert.equal(32, keyPair.privateKey.serialize().byteLength);
      assert.equal(33, keyPair.publicKey.serialize().byteLength);

      // The original incoming key is not modified
      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'second copy check'
      );

      // The keypair that comes out hasn't been updated either
      assert.equal(
        postClampHex,
        Bytes.toHex(keyPair.privateKey.serialize()),
        'keypair check'
      );
      assert.isTrue(
        constantTimeEqual(privateKey, keyPair.privateKey.serialize()),
        'keypair vs incoming value'
      );
    });
  });
});
