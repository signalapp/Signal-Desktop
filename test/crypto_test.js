// Copyright 2014-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

'use strict';

describe('Crypto', () => {
  describe('generateRegistrationId', () => {
    it('generates an integer between 0 and 16383 (inclusive)', () => {
      for (let i = 0; i < 100; i += 1) {
        const id = window.Signal.Crypto.generateRegistrationId();
        assert.isAtLeast(id, 0);
        assert.isAtMost(id, 16383);
        assert(Number.isInteger(id));
      }
    });
  });

  describe('deriveSecrets', () => {
    it('derives key parts via HKDF', () => {
      const input = window.Signal.Crypto.getRandomBytes(32);
      const salt = window.Signal.Crypto.getRandomBytes(32);
      const info = window.Signal.Crypto.bytesFromString('Hello world');
      const result = window.Signal.Crypto.deriveSecrets(input, salt, info);
      assert.lengthOf(result, 3);
      result.forEach(part => {
        // This is a smoke test; HKDF is tested as part of @signalapp/signal-client.
        assert.instanceOf(part, ArrayBuffer);
        assert.strictEqual(part.byteLength, 32);
      });
    });
  });

  describe('accessKey/profileKey', () => {
    it('verification roundtrips', async () => {
      const profileKey = await window.Signal.Crypto.getRandomBytes(32);
      const accessKey = await window.Signal.Crypto.deriveAccessKey(profileKey);

      const verifier = await window.Signal.Crypto.getAccessKeyVerifier(
        accessKey
      );

      const correct = await window.Signal.Crypto.verifyAccessKey(
        accessKey,
        verifier
      );

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
        const gv1 = window.Signal.Crypto.hexToArrayBuffer(vector.gv1);
        const expectedHex = vector.masterKey;

        const actual = await window.Signal.Crypto.deriveMasterKeyFromGroupV1(
          gv1
        );
        const actualHex = window.Signal.Crypto.arrayBufferToHex(actual);

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
      const key = window.Signal.Crypto.getRandomBytes(32);

      const encrypted = await window.Signal.Crypto.encryptSymmetric(
        key,
        plaintext
      );
      const decrypted = await window.Signal.Crypto.decryptSymmetric(
        key,
        encrypted
      );

      const equal = window.Signal.Crypto.constantTimeEqual(
        plaintext,
        decrypted
      );
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
      const key = window.Signal.Crypto.getRandomBytes(32);

      const encrypted = await window.Signal.Crypto.encryptSymmetric(
        key,
        plaintext
      );
      const uintArray = new Uint8Array(encrypted);
      uintArray[2] += 2;

      try {
        await window.Signal.Crypto.decryptSymmetric(
          key,
          window.window.Signal.Crypto.typedArrayToArrayBuffer(uintArray)
        );
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
      const key = window.Signal.Crypto.getRandomBytes(32);

      const encrypted = await window.Signal.Crypto.encryptSymmetric(
        key,
        plaintext
      );
      const uintArray = new Uint8Array(encrypted);
      uintArray[uintArray.length - 3] += 2;

      try {
        await window.Signal.Crypto.decryptSymmetric(
          key,
          window.window.Signal.Crypto.typedArrayToArrayBuffer(uintArray)
        );
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
      const key = window.Signal.Crypto.getRandomBytes(32);

      const encrypted = await window.Signal.Crypto.encryptSymmetric(
        key,
        plaintext
      );
      const uintArray = new Uint8Array(encrypted);
      uintArray[35] += 9;

      try {
        await window.Signal.Crypto.decryptSymmetric(
          key,
          window.window.Signal.Crypto.typedArrayToArrayBuffer(uintArray)
        );
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
      const identityKey = window.Signal.Curve.generateKeyPair();

      const encrypted = await window.Signal.Crypto.encryptDeviceName(
        deviceName,
        identityKey.pubKey
      );
      const decrypted = await window.Signal.Crypto.decryptDeviceName(
        encrypted,
        identityKey.privKey
      );

      assert.strictEqual(decrypted, deviceName);
    });

    it('fails if iv is changed', async () => {
      const deviceName = 'v1.19.0 on Windows 10';
      const identityKey = window.Signal.Curve.generateKeyPair();

      const encrypted = await window.Signal.Crypto.encryptDeviceName(
        deviceName,
        identityKey.pubKey
      );
      encrypted.syntheticIv = window.Signal.Crypto.getRandomBytes(16);
      try {
        await window.Signal.Crypto.decryptDeviceName(
          encrypted,
          identityKey.privKey
        );
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
      const staticKeyPair = window.Signal.Curve.generateKeyPair();
      const message = 'this is my message';
      const plaintext = window.Signal.Crypto.bytesFromString(message);
      const path =
        'fa/facdf99c22945b1c9393345599a276f4b36ad7ccdc8c2467f5441b742c2d11fa';

      const encrypted = await window.Signal.Crypto.encryptAttachment(
        staticKeyPair.pubKey.slice(1),
        path,
        plaintext
      );
      const decrypted = await window.Signal.Crypto.decryptAttachment(
        staticKeyPair.privKey,
        path,
        encrypted
      );

      const equal = window.Signal.Crypto.constantTimeEqual(
        plaintext,
        decrypted
      );
      if (!equal) {
        throw new Error('The output and input did not match!');
      }
    });
  });

  describe('verifyHmacSha256', () => {
    it('rejects if their MAC is too short', async () => {
      const key = window.Signal.Crypto.getRandomBytes(32);
      const plaintext = window.Signal.Crypto.bytesFromString('Hello world');
      const ourMac = await window.Signal.Crypto.hmacSha256(key, plaintext);
      const theirMac = ourMac.slice(0, -1);
      let error;
      try {
        await window.Signal.Crypto.verifyHmacSha256(
          plaintext,
          key,
          theirMac,
          ourMac.byteLength
        );
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC length');
    });

    it('rejects if their MAC is too long', async () => {
      const key = window.Signal.Crypto.getRandomBytes(32);
      const plaintext = window.Signal.Crypto.bytesFromString('Hello world');
      const ourMac = await window.Signal.Crypto.hmacSha256(key, plaintext);
      const theirMac = window.Signal.Crypto.concatenateBytes(
        ourMac,
        new Uint8Array([0xff])
      );
      let error;
      try {
        await window.Signal.Crypto.verifyHmacSha256(
          plaintext,
          key,
          theirMac,
          ourMac.byteLength
        );
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC length');
    });

    it('rejects if our MAC is shorter than the specified length', async () => {
      const key = window.Signal.Crypto.getRandomBytes(32);
      const plaintext = window.Signal.Crypto.bytesFromString('Hello world');
      const ourMac = await window.Signal.Crypto.hmacSha256(key, plaintext);
      const theirMac = ourMac;
      let error;
      try {
        await window.Signal.Crypto.verifyHmacSha256(
          plaintext,
          key,
          theirMac,
          ourMac.byteLength + 1
        );
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC length');
    });

    it("rejects if the MACs don't match", async () => {
      const plaintext = window.Signal.Crypto.bytesFromString('Hello world');
      const ourKey = window.Signal.Crypto.getRandomBytes(32);
      const ourMac = await window.Signal.Crypto.hmacSha256(ourKey, plaintext);
      const theirKey = window.Signal.Crypto.getRandomBytes(32);
      const theirMac = await window.Signal.Crypto.hmacSha256(
        theirKey,
        plaintext
      );
      let error;
      try {
        await window.Signal.Crypto.verifyHmacSha256(
          plaintext,
          ourKey,
          theirMac,
          ourMac.byteLength
        );
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC');
    });

    it('resolves with undefined if the MACs match exactly', async () => {
      const key = window.Signal.Crypto.getRandomBytes(32);
      const plaintext = window.Signal.Crypto.bytesFromString('Hello world');
      const theirMac = await window.Signal.Crypto.hmacSha256(key, plaintext);
      const result = await window.Signal.Crypto.verifyHmacSha256(
        plaintext,
        key,
        theirMac,
        theirMac.byteLength
      );
      assert.isUndefined(result);
    });

    it('resolves with undefined if the first `length` bytes of the MACs match', async () => {
      const key = window.Signal.Crypto.getRandomBytes(32);
      const plaintext = window.Signal.Crypto.bytesFromString('Hello world');
      const theirMac = (
        await window.Signal.Crypto.hmacSha256(key, plaintext)
      ).slice(0, -5);
      const result = await window.Signal.Crypto.verifyHmacSha256(
        plaintext,
        key,
        theirMac,
        theirMac.byteLength
      );
      assert.isUndefined(result);
    });
  });

  describe('uuidToArrayBuffer', () => {
    const { uuidToArrayBuffer } = window.Signal.Crypto;

    it('converts valid UUIDs to ArrayBuffers', () => {
      const expectedResult = window.window.Signal.Crypto.typedArrayToArrayBuffer(
        new Uint8Array([
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
        ])
      );

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
    const { arrayBufferToUuid } = window.Signal.Crypto;

    it('converts valid ArrayBuffers to UUID strings', () => {
      const buf = window.window.Signal.Crypto.typedArrayToArrayBuffer(
        new Uint8Array([
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
        ])
      );

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
      assert.isUndefined(
        arrayBufferToUuid(
          window.window.Signal.Crypto.typedArrayToArrayBuffer(
            new Uint8Array([0x22])
          )
        )
      );
      assert.isUndefined(
        arrayBufferToUuid(
          window.window.Signal.Crypto.typedArrayToArrayBuffer(
            new Uint8Array(Array(17).fill(0x22))
          )
        )
      );
    });
  });
});
