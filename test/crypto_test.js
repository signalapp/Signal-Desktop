// Copyright 2014-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

  describe('deriveMasterKeyFromGroupV1', () => {
    const vectors = [
      {
        gv1: '00000000000000000000000000000000',
        masterKey:
          'dbde68f4ee9169081f8814eabc65523fea1359235c8cfca32b69e31dce58b039',
      },
      {
        gv1: '000102030405060708090a0b0c0d0e0f',
        masterKey:
          '70884f78f07a94480ee36b67a4b5e975e92e4a774561e3df84c9076e3be4b9bf',
      },
      {
        gv1: '7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f7f',
        masterKey:
          'e69bf7c183b288b4ea5745b7c52b651a61e57769fafde683a6fdf1240f1905f2',
      },
      {
        gv1: 'ffffffffffffffffffffffffffffffff',
        masterKey:
          'dd3a7de23d10f18b64457fbeedc76226c112a730e4b76112e62c36c4432eb37d',
      },
    ];

    vectors.forEach((vector, index) => {
      it(`vector ${index}`, async () => {
        const gv1 = Signal.Crypto.hexToArrayBuffer(vector.gv1);
        const expectedHex = vector.masterKey;

        const actual = await Signal.Crypto.deriveMasterKeyFromGroupV1(gv1);
        const actualHex = Signal.Crypto.arrayBufferToHex(actual);

        assert.strictEqual(actualHex, expectedHex);
      });
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

  describe('encrypted device name', () => {
    it('roundtrips', async () => {
      const deviceName = 'v1.19.0 on Windows 10';
      const identityKey = await libsignal.KeyHelper.generateIdentityKeyPair();

      const encrypted = await Signal.Crypto.encryptDeviceName(
        deviceName,
        identityKey.pubKey
      );
      const decrypted = await Signal.Crypto.decryptDeviceName(
        encrypted,
        identityKey.privKey
      );

      assert.strictEqual(decrypted, deviceName);
    });

    it('fails if iv is changed', async () => {
      const deviceName = 'v1.19.0 on Windows 10';
      const identityKey = await libsignal.KeyHelper.generateIdentityKeyPair();

      const encrypted = await Signal.Crypto.encryptDeviceName(
        deviceName,
        identityKey.pubKey
      );
      encrypted.syntheticIv = Signal.Crypto.getRandomBytes(16);
      try {
        await Signal.Crypto.decryptDeviceName(encrypted, identityKey.privKey);
      } catch (error) {
        assert.strictEqual(
          error.message,
          'decryptDeviceName: synthetic IV did not match'
        );
      }
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

  describe('uuidToArrayBuffer', () => {
    const { uuidToArrayBuffer } = Signal.Crypto;

    it('converts valid UUIDs to ArrayBuffers', () => {
      const expectedResult = new Uint8Array([
        0x22,
        0x6e,
        0x44,
        0x02,
        0x7f,
        0xfc,
        0x45,
        0x43,
        0x85,
        0xc9,
        0x46,
        0x22,
        0xc5,
        0x0a,
        0x5b,
        0x14,
      ]).buffer;

      assert.deepEqual(
        uuidToArrayBuffer('226e4402-7ffc-4543-85c9-4622c50a5b14'),
        expectedResult
      );
      assert.deepEqual(
        uuidToArrayBuffer('226E4402-7FFC-4543-85C9-4622C50A5B14'),
        expectedResult
      );
    });

    it('returns an empty ArrayBuffer for strings of the wrong length', () => {
      assert.deepEqual(uuidToArrayBuffer(''), new ArrayBuffer(0));
      assert.deepEqual(uuidToArrayBuffer('abc'), new ArrayBuffer(0));
      assert.deepEqual(
        uuidToArrayBuffer('032deadf0d5e4ee78da28e75b1dfb284'),
        new ArrayBuffer(0)
      );
      assert.deepEqual(
        uuidToArrayBuffer('deaed5eb-d983-456a-a954-9ad7a006b271aaaaaaaaaa'),
        new ArrayBuffer(0)
      );
    });
  });

  describe('arrayBufferToUuid', () => {
    const { arrayBufferToUuid } = Signal.Crypto;

    it('converts valid ArrayBuffers to UUID strings', () => {
      const buf = new Uint8Array([
        0x22,
        0x6e,
        0x44,
        0x02,
        0x7f,
        0xfc,
        0x45,
        0x43,
        0x85,
        0xc9,
        0x46,
        0x22,
        0xc5,
        0x0a,
        0x5b,
        0x14,
      ]).buffer;

      assert.deepEqual(
        arrayBufferToUuid(buf),
        '226e4402-7ffc-4543-85c9-4622c50a5b14'
      );
    });

    it('returns undefined if passed an all-zero buffer', () => {
      assert.isUndefined(arrayBufferToUuid(new ArrayBuffer(16)));
    });

    it('returns undefined if passed the wrong number of bytes', () => {
      assert.isUndefined(arrayBufferToUuid(new ArrayBuffer(0)));
      assert.isUndefined(arrayBufferToUuid(new Uint8Array([0x22]).buffer));
      assert.isUndefined(
        arrayBufferToUuid(new Uint8Array(Array(17).fill(0x22)).buffer)
      );
    });
  });
});
