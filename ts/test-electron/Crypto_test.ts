// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import * as Bytes from '../Bytes';
import * as Curve from '../Curve';
import {
  PaddedLengths,
  encryptProfileItemWithPadding,
  decryptProfileName,
  encryptProfile,
  decryptProfile,
  getRandomBytes,
  constantTimeEqual,
  generateRegistrationId,
  deriveSecrets,
  encryptDeviceName,
  decryptDeviceName,
  deriveAccessKey,
  getAccessKeyVerifier,
  verifyAccessKey,
  deriveMasterKeyFromGroupV1,
  encryptSymmetric,
  decryptSymmetric,
  hmacSha256,
  verifyHmacSha256,
  uuidToBytes,
  bytesToUuid,
} from '../Crypto';

describe('Crypto', () => {
  describe('encrypting and decrypting profile data', () => {
    const NAME_PADDED_LENGTH = 53;
    describe('encrypting and decrypting profile names', () => {
      it('pads, encrypts, decrypts, and unpads a short string', () => {
        const name = 'Alice';
        const buffer = Bytes.fromString(name);
        const key = getRandomBytes(32);

        const encrypted = encryptProfileItemWithPadding(
          buffer,
          key,
          PaddedLengths.Name
        );
        assert.equal(encrypted.byteLength, NAME_PADDED_LENGTH + 16 + 12);

        const { given, family } = decryptProfileName(
          Bytes.toBase64(encrypted),
          key
        );
        assert.strictEqual(family, null);
        assert.strictEqual(Bytes.toString(given), name);
      });

      it('handles a given name of the max, 53 characters', () => {
        const name = '01234567890123456789012345678901234567890123456789123';
        const buffer = Bytes.fromString(name);
        const key = getRandomBytes(32);

        const encrypted = encryptProfileItemWithPadding(
          buffer,
          key,
          PaddedLengths.Name
        );
        assert.equal(encrypted.byteLength, NAME_PADDED_LENGTH + 16 + 12);
        const { given, family } = decryptProfileName(
          Bytes.toBase64(encrypted),
          key
        );

        assert.strictEqual(Bytes.toString(given), name);
        assert.strictEqual(family, null);
      });

      it('handles family/given name of the max, 53 characters', () => {
        const name =
          '01234567890123456789\u000001234567890123456789012345678912';
        const buffer = Bytes.fromString(name);
        const key = getRandomBytes(32);

        const encrypted = encryptProfileItemWithPadding(
          buffer,
          key,
          PaddedLengths.Name
        );
        assert.equal(encrypted.byteLength, NAME_PADDED_LENGTH + 16 + 12);
        const { given, family } = decryptProfileName(
          Bytes.toBase64(encrypted),
          key
        );
        assert.strictEqual(Bytes.toString(given), '01234567890123456789');
        assert.strictEqual(
          family && Bytes.toString(family),
          '01234567890123456789012345678912'
        );
      });

      it('handles a string with family/given name', () => {
        const name = 'Alice\0Jones';
        const buffer = Bytes.fromString(name);
        const key = getRandomBytes(32);

        const encrypted = encryptProfileItemWithPadding(
          buffer,
          key,
          PaddedLengths.Name
        );
        assert.equal(encrypted.byteLength, NAME_PADDED_LENGTH + 16 + 12);
        const { given, family } = decryptProfileName(
          Bytes.toBase64(encrypted),
          key
        );
        assert.strictEqual(Bytes.toString(given), 'Alice');
        assert.strictEqual(family && Bytes.toString(family), 'Jones');
      });

      it('works for empty string', () => {
        const name = Bytes.fromString('');
        const key = getRandomBytes(32);

        const encrypted = encryptProfileItemWithPadding(
          name,
          key,
          PaddedLengths.Name
        );
        assert.equal(encrypted.byteLength, NAME_PADDED_LENGTH + 16 + 12);

        const { given, family } = decryptProfileName(
          Bytes.toBase64(encrypted),
          key
        );
        assert.strictEqual(family, null);
        assert.strictEqual(given.byteLength, 0);
        assert.strictEqual(Bytes.toString(given), '');
      });
    });

    describe('encrypting and decrypting profile avatars', () => {
      it('encrypts and decrypts', async () => {
        const buffer = Bytes.fromString('This is an avatar');
        const key = getRandomBytes(32);

        const encrypted = encryptProfile(buffer, key);
        assert(encrypted.byteLength === buffer.byteLength + 16 + 12);

        const decrypted = decryptProfile(encrypted, key);
        assert(constantTimeEqual(buffer, decrypted));
      });

      it('throws when decrypting with the wrong key', () => {
        const buffer = Bytes.fromString('This is an avatar');
        const key = getRandomBytes(32);
        const badKey = getRandomBytes(32);

        const encrypted = encryptProfile(buffer, key);
        assert(encrypted.byteLength === buffer.byteLength + 16 + 12);
        assert.throws(
          () => decryptProfile(encrypted, badKey),
          'Failed to decrypt profile data. Most likely the profile key has changed.'
        );
      });
    });
  });

  describe('generateRegistrationId', () => {
    it('generates an integer between 0 and 16383 (inclusive)', () => {
      let max = 0;
      for (let i = 0; i < 100; i += 1) {
        const id = generateRegistrationId();
        assert.isAtLeast(id, 0);
        assert.isAtMost(id, 16383);
        assert(Number.isInteger(id));

        max = Math.max(max, id);
      }

      // Probability of this being false is ~ 10^{-181}
      assert.isAtLeast(max, 0x100);
    });
  });

  describe('deriveSecrets', () => {
    it('derives key parts via HKDF', () => {
      const input = getRandomBytes(32);
      const salt = getRandomBytes(32);
      const info = Bytes.fromString('Hello world');
      const result = deriveSecrets(input, salt, info);
      assert.lengthOf(result, 3);
      result.forEach(part => {
        // This is a smoke test; HKDF is tested as part of @signalapp/libsignal-client.
        assert.instanceOf(part, Uint8Array);
        assert.strictEqual(part.byteLength, 32);
      });
    });
  });

  describe('accessKey/profileKey', () => {
    it('verification roundtrips', () => {
      const profileKey = getRandomBytes(32);
      const accessKey = deriveAccessKey(profileKey);

      const verifier = getAccessKeyVerifier(accessKey);

      const correct = verifyAccessKey(accessKey, verifier);

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
      it(`vector ${index}`, () => {
        const gv1 = Bytes.fromHex(vector.gv1);
        const expectedHex = vector.masterKey;

        const actual = deriveMasterKeyFromGroupV1(gv1);
        const actualHex = Bytes.toHex(actual);

        assert.strictEqual(actualHex, expectedHex);
      });
    });
  });

  describe('symmetric encryption', () => {
    it('roundtrips', () => {
      const message = 'this is my message';
      const plaintext = Bytes.fromString(message);
      const key = getRandomBytes(32);

      const encrypted = encryptSymmetric(key, plaintext);
      const decrypted = decryptSymmetric(key, encrypted);

      const equal = constantTimeEqual(plaintext, decrypted);
      if (!equal) {
        throw new Error('The output and input did not match!');
      }
    });

    it('roundtrip fails if nonce is modified', () => {
      const message = 'this is my message';
      const plaintext = Bytes.fromString(message);
      const key = getRandomBytes(32);

      const encrypted = encryptSymmetric(key, plaintext);
      encrypted[2] += 2;

      try {
        decryptSymmetric(key, encrypted);
      } catch (error) {
        assert.strictEqual(
          error.message,
          'decryptSymmetric: Failed to decrypt; MAC verification failed'
        );
        return;
      }

      throw new Error('Expected error to be thrown');
    });

    it('roundtrip fails if mac is modified', () => {
      const message = 'this is my message';
      const plaintext = Bytes.fromString(message);
      const key = getRandomBytes(32);

      const encrypted = encryptSymmetric(key, plaintext);
      encrypted[encrypted.length - 3] += 2;

      try {
        decryptSymmetric(key, encrypted);
      } catch (error) {
        assert.strictEqual(
          error.message,
          'decryptSymmetric: Failed to decrypt; MAC verification failed'
        );
        return;
      }

      throw new Error('Expected error to be thrown');
    });

    it('roundtrip fails if encrypted contents are modified', () => {
      const message = 'this is my message';
      const plaintext = Bytes.fromString(message);
      const key = getRandomBytes(32);

      const encrypted = encryptSymmetric(key, plaintext);
      encrypted[35] += 9;

      try {
        decryptSymmetric(key, encrypted);
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
    it('roundtrips', () => {
      const deviceName = 'v1.19.0 on Windows 10';
      const identityKey = Curve.generateKeyPair();

      const encrypted = encryptDeviceName(deviceName, identityKey.pubKey);
      const decrypted = decryptDeviceName(encrypted, identityKey.privKey);

      assert.strictEqual(decrypted, deviceName);
    });

    it('fails if iv is changed', () => {
      const deviceName = 'v1.19.0 on Windows 10';
      const identityKey = Curve.generateKeyPair();

      const encrypted = encryptDeviceName(deviceName, identityKey.pubKey);
      encrypted.syntheticIv = getRandomBytes(16);
      try {
        decryptDeviceName(encrypted, identityKey.privKey);
      } catch (error) {
        assert.strictEqual(
          error.message,
          'decryptDeviceName: synthetic IV did not match'
        );
      }
    });
  });

  describe('verifyHmacSha256', () => {
    it('rejects if their MAC is too short', () => {
      const key = getRandomBytes(32);
      const plaintext = Bytes.fromString('Hello world');
      const ourMac = hmacSha256(key, plaintext);
      const theirMac = ourMac.slice(0, -1);
      let error;
      try {
        verifyHmacSha256(plaintext, key, theirMac, ourMac.byteLength);
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC length');
    });

    it('rejects if their MAC is too long', () => {
      const key = getRandomBytes(32);
      const plaintext = Bytes.fromString('Hello world');
      const ourMac = hmacSha256(key, plaintext);
      const theirMac = Bytes.concatenate([ourMac, new Uint8Array([0xff])]);
      let error;
      try {
        verifyHmacSha256(plaintext, key, theirMac, ourMac.byteLength);
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC length');
    });

    it('rejects if our MAC is shorter than the specified length', () => {
      const key = getRandomBytes(32);
      const plaintext = Bytes.fromString('Hello world');
      const ourMac = hmacSha256(key, plaintext);
      const theirMac = ourMac;
      let error;
      try {
        verifyHmacSha256(plaintext, key, theirMac, ourMac.byteLength + 1);
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC length');
    });

    it("rejects if the MACs don't match", () => {
      const plaintext = Bytes.fromString('Hello world');
      const ourKey = getRandomBytes(32);
      const ourMac = hmacSha256(ourKey, plaintext);
      const theirKey = getRandomBytes(32);
      const theirMac = hmacSha256(theirKey, plaintext);
      let error;
      try {
        verifyHmacSha256(plaintext, ourKey, theirMac, ourMac.byteLength);
      } catch (err) {
        error = err;
      }
      assert.instanceOf(error, Error);
      assert.strictEqual(error.message, 'Bad MAC');
    });

    it('resolves with undefined if the MACs match exactly', () => {
      const key = getRandomBytes(32);
      const plaintext = Bytes.fromString('Hello world');
      const theirMac = hmacSha256(key, plaintext);
      const result = verifyHmacSha256(
        plaintext,
        key,
        theirMac,
        theirMac.byteLength
      );
      assert.isUndefined(result);
    });

    it('resolves with undefined if the first `length` bytes of the MACs match', () => {
      const key = getRandomBytes(32);
      const plaintext = Bytes.fromString('Hello world');
      const theirMac = hmacSha256(key, plaintext).slice(0, -5);
      const result = verifyHmacSha256(
        plaintext,
        key,
        theirMac,
        theirMac.byteLength
      );
      assert.isUndefined(result);
    });
  });

  describe('uuidToBytes', () => {
    it('converts valid UUIDs to Uint8Arrays', () => {
      const expectedResult = new Uint8Array([
        0x22, 0x6e, 0x44, 0x02, 0x7f, 0xfc, 0x45, 0x43, 0x85, 0xc9, 0x46, 0x22,
        0xc5, 0x0a, 0x5b, 0x14,
      ]);

      assert.deepEqual(
        uuidToBytes('226e4402-7ffc-4543-85c9-4622c50a5b14'),
        expectedResult
      );
      assert.deepEqual(
        uuidToBytes('226E4402-7FFC-4543-85C9-4622C50A5B14'),
        expectedResult
      );
    });

    it('returns an empty Uint8Array for strings of the wrong length', () => {
      assert.deepEqual(uuidToBytes(''), new Uint8Array(0));
      assert.deepEqual(uuidToBytes('abc'), new Uint8Array(0));
      assert.deepEqual(
        uuidToBytes('032deadf0d5e4ee78da28e75b1dfb284'),
        new Uint8Array(0)
      );
      assert.deepEqual(
        uuidToBytes('deaed5eb-d983-456a-a954-9ad7a006b271aaaaaaaaaa'),
        new Uint8Array(0)
      );
    });
  });

  describe('bytesToUuid', () => {
    it('converts valid Uint8Arrays to UUID strings', () => {
      const buf = new Uint8Array([
        0x22, 0x6e, 0x44, 0x02, 0x7f, 0xfc, 0x45, 0x43, 0x85, 0xc9, 0x46, 0x22,
        0xc5, 0x0a, 0x5b, 0x14,
      ]);

      assert.deepEqual(
        bytesToUuid(buf),
        '226e4402-7ffc-4543-85c9-4622c50a5b14'
      );
    });

    it('returns undefined if passed an all-zero buffer', () => {
      assert.isUndefined(bytesToUuid(new Uint8Array(16)));
    });

    it('returns undefined if passed the wrong number of bytes', () => {
      assert.isUndefined(bytesToUuid(new Uint8Array(0)));
      assert.isUndefined(bytesToUuid(new Uint8Array([0x22])));
      assert.isUndefined(bytesToUuid(new Uint8Array(Array(17).fill(0x22))));
    });
  });
});
