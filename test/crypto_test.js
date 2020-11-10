/* global Signal, textsecure, libsignal */

'use strict';

describe('Crypto', () => {
  describe('accessKey/profileKey', () => {
    it('verification roundtrips', async () => {
      const profileKey = await Signal.Crypto.getRandomBytes(32);
      const accessKey = await Signal.Crypto.deriveAccessKey(profileKey);

      const verifier = await Signal.Crypto.getAccessKeyVerifier(accessKey);

      const correct = await Signal.Crypto.verifyAccessKey(accessKey, verifier);

      assert.strictEqual(correct, true);
    });
  });

  describe('symmetric encryption', () => {
    it('roundtrips', async () => {
      const message = 'this is my message';
      const plaintext = dcodeIO.ByteBuffer.wrap(
        message,
        'binary'
      ).toArrayBuffer();
      const key = textsecure.crypto.getRandomBytes(32);

      const encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
      const decrypted = await Signal.Crypto.decryptSymmetric(key, encrypted);

      const equal = Signal.Crypto.constantTimeEqual(plaintext, decrypted);
      if (!equal) {
        throw new Error('The output and input did not match!');
      }
    });

    it('roundtrip fails if nonce is modified', async () => {
      const message = 'this is my message';
      const plaintext = dcodeIO.ByteBuffer.wrap(
        message,
        'binary'
      ).toArrayBuffer();
      const key = textsecure.crypto.getRandomBytes(32);

      const encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
      const uintArray = new Uint8Array(encrypted);
      uintArray[2] += 2;

      try {
        await Signal.Crypto.decryptSymmetric(key, uintArray.buffer);
      } catch (error) {
        assert.strictEqual(
          error.message,
          'decryptSymmetric: Failed to decrypt; MAC verification failed'
        );
        return;
      }

      throw new Error('Expected error to be thrown');
    });

    it('roundtrip fails if mac is modified', async () => {
      const message = 'this is my message';
      const plaintext = dcodeIO.ByteBuffer.wrap(
        message,
        'binary'
      ).toArrayBuffer();
      const key = textsecure.crypto.getRandomBytes(32);

      const encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
      const uintArray = new Uint8Array(encrypted);
      uintArray[uintArray.length - 3] += 2;

      try {
        await Signal.Crypto.decryptSymmetric(key, uintArray.buffer);
      } catch (error) {
        assert.strictEqual(
          error.message,
          'decryptSymmetric: Failed to decrypt; MAC verification failed'
        );
        return;
      }

      throw new Error('Expected error to be thrown');
    });

    it('roundtrip fails if encrypted contents are modified', async () => {
      const message = 'this is my message';
      const plaintext = dcodeIO.ByteBuffer.wrap(
        message,
        'binary'
      ).toArrayBuffer();
      const key = textsecure.crypto.getRandomBytes(32);

      const encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
      const uintArray = new Uint8Array(encrypted);
      uintArray[35] += 9;

      try {
        await Signal.Crypto.decryptSymmetric(key, uintArray.buffer);
      } catch (error) {
        assert.strictEqual(
          error.message,
          'decryptSymmetric: Failed to decrypt; MAC verification failed'
        );
        return;
      }

      throw new Error('Expected error to be thrown');
    });
  });

  describe('attachment encryption', () => {
    it('roundtrips', async () => {
      const staticKeyPair = await libsignal.KeyHelper.generateIdentityKeyPair();
      const message = 'this is my message';
      const plaintext = Signal.Crypto.bytesFromString(message);
      const path =
        'fa/facdf99c22945b1c9393345599a276f4b36ad7ccdc8c2467f5441b742c2d11fa';

      const encrypted = await Signal.Crypto.encryptAttachment(
        staticKeyPair.pubKey.slice(1),
        path,
        plaintext
      );
      const decrypted = await Signal.Crypto.decryptAttachment(
        staticKeyPair.privKey,
        path,
        encrypted
      );

      const equal = Signal.Crypto.constantTimeEqual(plaintext, decrypted);
      if (!equal) {
        throw new Error('The output and input did not match!');
      }
    });
  });
});
