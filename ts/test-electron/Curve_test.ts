// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  arrayBufferToHex,
  constantTimeEqual,
  getRandomBytes,
  hexToArrayBuffer,
  typedArrayToArrayBuffer,
} from '../Crypto';
import {
  calculateSignature,
  clampPrivateKey,
  createKeyPair,
  copyArrayBuffer,
  calculateAgreement,
  generateKeyPair,
  generatePreKey,
  generateSignedPreKey,
  isNonNegativeInteger,
  verifySignature,
} from '../Curve';

describe('Curve', () => {
  it('verifySignature roundtrip', () => {
    const message = typedArrayToArrayBuffer(Buffer.from('message'));
    const { pubKey, privKey } = generateKeyPair();
    const signature = calculateSignature(privKey, message);
    const verified = verifySignature(pubKey, message, signature);

    assert.isTrue(verified);
  });

  it('calculateAgreement roundtrip', () => {
    const alice = generateKeyPair();
    const bob = generateKeyPair();

    const sharedSecretAlice = calculateAgreement(bob.pubKey, alice.privKey);
    const sharedSecretBob = calculateAgreement(alice.pubKey, bob.privKey);

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
        identityKeyPair.pubKey,
        signedPreKey.keyPair.pubKey,
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
      assert.equal(33, preKey.keyPair.pubKey.byteLength);
      assert.equal(32, preKey.keyPair.privKey.byteLength);
    });
  });

  describe('#copyArrayBuffer', () => {
    it('copy matches original', () => {
      const data = getRandomBytes(200);
      const dataHex = arrayBufferToHex(data);
      const copy = copyArrayBuffer(data);

      assert.equal(data.byteLength, copy.byteLength);
      assert.isTrue(constantTimeEqual(data, copy));

      assert.equal(dataHex, arrayBufferToHex(data));
      assert.equal(dataHex, arrayBufferToHex(copy));
    });

    it('copies into new memory location', () => {
      const data = getRandomBytes(200);
      const dataHex = arrayBufferToHex(data);
      const copy = copyArrayBuffer(data);

      const view = new Uint8Array(copy);
      view[0] += 1;
      view[1] -= 1;

      assert.equal(data.byteLength, copy.byteLength);
      assert.isFalse(constantTimeEqual(data, copy));

      assert.equal(dataHex, arrayBufferToHex(data));
      assert.notEqual(dataHex, arrayBufferToHex(copy));
    });
  });

  describe('#createKeyPair', () => {
    it('does not modify unclamped private key', () => {
      const initialHex =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const privateKey = hexToArrayBuffer(initialHex);
      const copyOfPrivateKey = copyArrayBuffer(privateKey);

      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'initial copy check'
      );

      const keyPair = createKeyPair(privateKey);

      assert.equal(32, keyPair.privKey.byteLength);
      assert.equal(33, keyPair.pubKey.byteLength);

      // The original incoming key is not modified
      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'second copy check'
      );

      // But the keypair that comes out has indeed been updated
      assert.notEqual(
        initialHex,
        arrayBufferToHex(keyPair.privKey),
        'keypair check'
      );
      assert.isFalse(
        constantTimeEqual(keyPair.privKey, privateKey),
        'keypair vs incoming value'
      );
    });

    it('does not modify clamped private key', () => {
      const initialHex =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const privateKey = hexToArrayBuffer(initialHex);
      clampPrivateKey(privateKey);
      const postClampHex = arrayBufferToHex(privateKey);
      const copyOfPrivateKey = copyArrayBuffer(privateKey);

      assert.notEqual(postClampHex, initialHex, 'initial clamp check');
      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'initial copy check'
      );

      const keyPair = createKeyPair(privateKey);

      assert.equal(32, keyPair.privKey.byteLength);
      assert.equal(33, keyPair.pubKey.byteLength);

      // The original incoming key is not modified
      assert.isTrue(
        constantTimeEqual(privateKey, copyOfPrivateKey),
        'second copy check'
      );

      // The keypair that comes out hasn't been updated either
      assert.equal(
        postClampHex,
        arrayBufferToHex(keyPair.privKey),
        'keypair check'
      );
      assert.isTrue(
        constantTimeEqual(privateKey, keyPair.privKey),
        'keypair vs incoming value'
      );
    });
  });
});
