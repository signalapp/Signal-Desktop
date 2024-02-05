// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { assert } from 'chai';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

import { randomBytes } from 'crypto';
import * as log from '../logging/log';
import * as Bytes from '../Bytes';
import * as Curve from '../Curve';
import {
  PaddedLengths,
  encryptProfileItemWithPadding,
  decryptProfileName,
  encryptProfile,
  decryptProfile,
  getAttachmentSizeBucket,
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
  randomInt,
  encryptAttachment,
  decryptAttachmentV1,
  padAndEncryptAttachment,
} from '../Crypto';
import {
  KEY_SET_LENGTH,
  _generateAttachmentIv,
  decryptAttachmentV2,
  encryptAttachmentV2,
} from '../AttachmentCrypto';
import { createTempDir, deleteTempDir } from '../updater/common';
import { uuidToBytes, bytesToUuid } from '../util/uuidToBytes';

const BUCKET_SIZES = [
  541, 568, 596, 626, 657, 690, 725, 761, 799, 839, 881, 925, 972, 1020, 1071,
  1125, 1181, 1240, 1302, 1367, 1436, 1507, 1583, 1662, 1745, 1832, 1924, 2020,
  2121, 2227, 2339, 2456, 2579, 2708, 2843, 2985, 3134, 3291, 3456, 3629, 3810,
  4001, 4201, 4411, 4631, 4863, 5106, 5361, 5629, 5911, 6207, 6517, 6843, 7185,
  7544, 7921, 8318, 8733, 9170, 9629, 10110, 10616, 11146, 11704, 12289, 12903,
  13549, 14226, 14937, 15684, 16469, 17292, 18157, 19065, 20018, 21019, 22070,
  23173, 24332, 25549, 26826, 28167, 29576, 31054, 32607, 34238, 35950, 37747,
  39634, 41616, 43697, 45882, 48176, 50585, 53114, 55770, 58558, 61486, 64561,
  67789, 71178, 74737, 78474, 82398, 86518, 90843, 95386, 100155, 105163,
  110421, 115942, 121739, 127826, 134217, 140928, 147975, 155373, 163142,
  171299, 179864, 188858, 198300, 208215, 218626, 229558, 241036, 253087,
  265742, 279029, 292980, 307629, 323011, 339161, 356119, 373925, 392622,
  412253, 432866, 454509, 477234, 501096, 526151, 552458, 580081, 609086,
  639540, 671517, 705093, 740347, 777365, 816233, 857045, 899897, 944892,
  992136, 1041743, 1093831, 1148522, 1205948, 1266246, 1329558, 1396036,
  1465838, 1539130, 1616086, 1696890, 1781735, 1870822, 1964363, 2062581,
  2165710, 2273996, 2387695, 2507080, 2632434, 2764056, 2902259, 3047372,
  3199740, 3359727, 3527714, 3704100, 3889305, 4083770, 4287958, 4502356,
  4727474, 4963848, 5212040, 5472642, 5746274, 6033588, 6335268, 6652031,
  6984633, 7333864, 7700558, 8085585, 8489865, 8914358, 9360076, 9828080,
  10319484, 10835458, 11377231, 11946092, 12543397, 13170567, 13829095,
  14520550, 15246578, 16008907, 16809352, 17649820, 18532311, 19458926,
  20431872, 21453466, 22526139, 23652446, 24835069, 26076822, 27380663,
  28749697, 30187181, 31696540, 33281368, 34945436, 36692708, 38527343,
  40453710, 42476396, 44600216, 46830227, 49171738, 51630325, 54211841,
  56922433, 59768555, 62756983, 65894832, 69189573, 72649052, 76281505,
  80095580, 84100359, 88305377, 92720646, 97356678, 102224512, 107335738,
];

const GHOST_KITTY_HASH =
  '7bc77f27d92d00b4a1d57c480ca86dacc43d57bc318339c92119d1fbf6b557a5';

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
    it('generates an integer between 1 and 16383 (inclusive)', () => {
      let max = -1;
      for (let i = 0; i < 100; i += 1) {
        const id = generateRegistrationId();
        assert.isAtLeast(id, 1);
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

  describe('randomInt', () => {
    it('returns random integers in a range (inclusive)', () => {
      const seen = new Set<number>();
      for (let i = 0; i < 1_000_000 || seen.size < 3; i += 1) {
        seen.add(randomInt(1, 3));
      }

      assert.deepStrictEqual(seen, new Set([1, 2, 3]));
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

  describe('getAttachmentSizeBucket', () => {
    it('properly calculates first bucket', () => {
      for (let size = 0, max = BUCKET_SIZES[0]; size < max; size += 1) {
        assert.strictEqual(BUCKET_SIZES[0], getAttachmentSizeBucket(size));
      }
    });

    it('properly calculates entire table', () => {
      let count = 0;

      const failures = new Array<string>();
      for (let i = 0, max = BUCKET_SIZES.length - 1; i < max; i += 1) {
        // Exact
        if (BUCKET_SIZES[i] !== getAttachmentSizeBucket(BUCKET_SIZES[i])) {
          count += 1;
          failures.push(
            `${BUCKET_SIZES[i]} does not equal ${getAttachmentSizeBucket(
              BUCKET_SIZES[i]
            )}`
          );
        }

        // Just under
        if (BUCKET_SIZES[i] !== getAttachmentSizeBucket(BUCKET_SIZES[i] - 1)) {
          count += 1;
          failures.push(
            `${BUCKET_SIZES[i]} does not equal ${getAttachmentSizeBucket(
              BUCKET_SIZES[i] - 1
            )}`
          );
        }

        // Just over
        if (
          BUCKET_SIZES[i + 1] !== getAttachmentSizeBucket(BUCKET_SIZES[i] + 1)
        ) {
          count += 1;
          failures.push(
            `${BUCKET_SIZES[i + 1]} does not equal ${getAttachmentSizeBucket(
              BUCKET_SIZES[i] + 1
            )}`
          );
        }
      }

      assert.strictEqual(count, 0, failures.join('\n'));
    });
  });

  describe('attachments', () => {
    const FILE_PATH = join(__dirname, '../../fixtures/ghost-kitty.mp4');
    const FILE_CONTENTS = readFileSync(FILE_PATH);
    let tempDir: string | undefined;

    function generateAttachmentKeys(): Uint8Array {
      return randomBytes(KEY_SET_LENGTH);
    }

    beforeEach(async () => {
      tempDir = await createTempDir();
    });
    afterEach(async () => {
      if (tempDir) {
        await deleteTempDir(log, tempDir);
      }
    });

    it('v1 roundtrips (memory only)', () => {
      const keys = generateAttachmentKeys();

      // Note: support for padding is not in decryptAttachmentV1, so we don't pad here
      const encryptedAttachment = encryptAttachment({
        plaintext: FILE_CONTENTS,
        keys,
      });
      const plaintext = decryptAttachmentV1(
        encryptedAttachment.ciphertext,
        keys,
        encryptedAttachment.digest
      );

      assert.isTrue(constantTimeEqual(FILE_CONTENTS, plaintext));
    });

    it('v1 -> v2 (memory -> disk)', async () => {
      const keys = generateAttachmentKeys();
      const ciphertextPath = join(tempDir!, 'file');
      let plaintextPath;

      try {
        const encryptedAttachment = padAndEncryptAttachment({
          plaintext: FILE_CONTENTS,
          keys,
        });
        assert.strictEqual(encryptedAttachment.plaintextHash, GHOST_KITTY_HASH);

        writeFileSync(ciphertextPath, encryptedAttachment.ciphertext);

        const decryptedAttachment = await decryptAttachmentV2({
          ciphertextPath,
          id: 'test',
          keys,
          size: FILE_CONTENTS.byteLength,
          theirDigest: encryptedAttachment.digest,
        });
        plaintextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
          decryptedAttachment.path
        );
        const plaintext = readFileSync(plaintextPath);

        assert.isTrue(constantTimeEqual(FILE_CONTENTS, plaintext));
        assert.strictEqual(
          encryptedAttachment.plaintextHash,
          decryptedAttachment.plaintextHash
        );
      } finally {
        if (plaintextPath) {
          unlinkSync(plaintextPath);
        }
      }
    });

    it('v2 roundtrips (all on disk)', async () => {
      const keys = generateAttachmentKeys();
      let plaintextPath;
      let ciphertextPath;

      try {
        const encryptedAttachment = await encryptAttachmentV2({
          keys,
          plaintextAbsolutePath: FILE_PATH,
          size: FILE_CONTENTS.byteLength,
        });
        ciphertextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
          encryptedAttachment.path
        );
        const decryptedAttachment = await decryptAttachmentV2({
          ciphertextPath,
          id: 'test',
          keys,
          size: FILE_CONTENTS.byteLength,
          theirDigest: encryptedAttachment.digest,
        });
        plaintextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
          decryptedAttachment.path
        );
        const plaintext = readFileSync(plaintextPath);
        assert.isTrue(constantTimeEqual(FILE_CONTENTS, plaintext));
        assert.strictEqual(encryptedAttachment.plaintextHash, GHOST_KITTY_HASH);
        assert.strictEqual(
          decryptedAttachment.plaintextHash,
          encryptedAttachment.plaintextHash
        );
      } finally {
        if (plaintextPath) {
          unlinkSync(plaintextPath);
        }
        if (ciphertextPath) {
          unlinkSync(ciphertextPath);
        }
      }
    });

    it('v2 -> v1 (disk -> memory)', async () => {
      const keys = generateAttachmentKeys();
      let ciphertextPath;

      try {
        const encryptedAttachment = await encryptAttachmentV2({
          keys,
          plaintextAbsolutePath: FILE_PATH,
          size: FILE_CONTENTS.byteLength,
        });
        ciphertextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
          encryptedAttachment.path
        );

        const ciphertext = readFileSync(ciphertextPath);

        const plaintext = decryptAttachmentV1(
          ciphertext,
          keys,
          encryptedAttachment.digest
        );

        const IV = 16;
        const MAC = 32;
        const PADDING_FOR_GHOST_KITTY = 126_066; // delta between file size and next bucket
        assert.strictEqual(
          plaintext.byteLength,
          FILE_CONTENTS.byteLength + IV + MAC + PADDING_FOR_GHOST_KITTY,
          'verify padding'
        );

        // Note: support for padding is not in decryptAttachmentV1, so we manually unpad
        const plaintextWithoutPadding = plaintext.subarray(
          0,
          FILE_CONTENTS.byteLength
        );
        assert.isTrue(
          constantTimeEqual(FILE_CONTENTS, plaintextWithoutPadding)
        );
      } finally {
        if (ciphertextPath) {
          unlinkSync(ciphertextPath);
        }
      }
    });

    it('v1 and v2 produce the same ciphertext, given same iv', async () => {
      const keys = generateAttachmentKeys();
      const dangerousTestOnlyIv = _generateAttachmentIv();

      let ciphertextPath;
      try {
        const encryptedAttachmentV1 = padAndEncryptAttachment({
          plaintext: FILE_CONTENTS,
          keys,
          dangerousTestOnlyIv,
        });
        const ciphertextV1 = encryptedAttachmentV1.ciphertext;

        const encryptedAttachmentV2 = await encryptAttachmentV2({
          keys,
          plaintextAbsolutePath: FILE_PATH,
          size: FILE_CONTENTS.byteLength,
          dangerousTestOnlyIv,
        });
        ciphertextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
          encryptedAttachmentV2.path
        );

        const ciphertextV2 = readFileSync(ciphertextPath);

        assert.strictEqual(ciphertextV1.byteLength, ciphertextV2.byteLength);

        assert.isTrue(constantTimeEqual(ciphertextV1, ciphertextV2));
      } finally {
        if (ciphertextPath) {
          unlinkSync(ciphertextPath);
        }
      }
    });
  });
});
