// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createCipheriv } from 'crypto';

import { assert } from 'chai';
import { isNumber } from 'lodash';

import * as log from '../logging/log';
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
  sha256,
  hmacSha256,
  verifyHmacSha256,
  randomInt,
  encryptAttachment,
  decryptAttachmentV1,
  padAndEncryptAttachment,
  CipherType,
} from '../Crypto';
import {
  type HardcodedIVForEncryptionType,
  _generateAttachmentIv,
  decryptAttachmentV2,
  encryptAttachmentV2ToDisk,
  getAesCbcCiphertextLength,
  getAttachmentCiphertextLength,
  splitKeys,
  generateAttachmentKeys,
  type DecryptedAttachmentV2,
} from '../AttachmentCrypto';
import { createTempDir, deleteTempDir } from '../updater/common';
import { uuidToBytes, bytesToUuid } from '../util/uuidToBytes';

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

  describe('attachments', () => {
    const FILE_PATH = join(__dirname, '../../fixtures/ghost-kitty.mp4');
    const FILE_CONTENTS = readFileSync(FILE_PATH);
    const FILE_HASH = sha256(FILE_CONTENTS);
    let tempDir: string;

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
      const ciphertextPath = join(tempDir, 'file');
      let plaintextPath;

      try {
        const encryptedAttachment = padAndEncryptAttachment({
          plaintext: FILE_CONTENTS,
          keys,
        });
        assert.strictEqual(encryptedAttachment.plaintextHash, GHOST_KITTY_HASH);

        writeFileSync(ciphertextPath, encryptedAttachment.ciphertext);

        const decryptedAttachment = await decryptAttachmentV2({
          type: 'standard',
          ciphertextPath,
          idForLogging: 'test',
          ...splitKeys(keys),
          size: FILE_CONTENTS.byteLength,
          theirDigest: encryptedAttachment.digest,
          theirIncrementalMac: undefined,
          theirChunkSize: undefined,
          getAbsoluteAttachmentPath:
            window.Signal.Migrations.getAbsoluteAttachmentPath,
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

    describe('v2 roundtrips', () => {
      async function testV2RoundTripData({
        path,
        data,
        plaintextHash,
        encryptionKeys,
        dangerousIv,
        modifyIncrementalMac,
        overrideSize,
      }: {
        path?: string;
        data: Uint8Array;
        plaintextHash?: Uint8Array;
        encryptionKeys?: Uint8Array;
        dangerousIv?: HardcodedIVForEncryptionType;
        modifyIncrementalMac?: boolean;
        overrideSize?: number;
      }): Promise<DecryptedAttachmentV2> {
        let plaintextPath;
        let ciphertextPath;
        const keys = encryptionKeys ?? generateAttachmentKeys();

        try {
          const encryptedAttachment = await encryptAttachmentV2ToDisk({
            keys,
            plaintext: path ? { absolutePath: path } : { data },
            dangerousIv,
            getAbsoluteAttachmentPath:
              window.Signal.Migrations.getAbsoluteAttachmentPath,
            needIncrementalMac: true,
          });

          ciphertextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
            encryptedAttachment.path
          );

          const macLength = encryptedAttachment.incrementalMac?.length;
          if (
            modifyIncrementalMac &&
            isNumber(macLength) &&
            encryptedAttachment.incrementalMac
          ) {
            encryptedAttachment.incrementalMac[macLength / 2] += 1;
          }

          const decryptedAttachment = await decryptAttachmentV2({
            type: 'standard',
            ciphertextPath,
            idForLogging: 'test',
            ...splitKeys(keys),
            size: overrideSize ?? data.byteLength,
            theirDigest: encryptedAttachment.digest,
            theirIncrementalMac: encryptedAttachment.incrementalMac,
            theirChunkSize: encryptedAttachment.chunkSize,
            getAbsoluteAttachmentPath:
              window.Signal.Migrations.getAbsoluteAttachmentPath,
          });
          plaintextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
            decryptedAttachment.path
          );

          const plaintext = readFileSync(plaintextPath);

          assert.deepStrictEqual(
            encryptedAttachment.iv,
            decryptedAttachment.iv
          );
          if (dangerousIv) {
            assert.deepStrictEqual(encryptedAttachment.iv, dangerousIv.iv);
            if (dangerousIv.reason === 'reencrypting-for-backup') {
              assert.deepStrictEqual(
                encryptedAttachment.digest,
                dangerousIv.digestToMatch
              );
            }
          }

          assert.strictEqual(
            encryptedAttachment.ciphertextSize,
            getAttachmentCiphertextLength(data.byteLength)
          );

          if (overrideSize == null) {
            assert.isTrue(constantTimeEqual(data, plaintext));
            assert.strictEqual(
              decryptedAttachment.plaintextHash,
              encryptedAttachment.plaintextHash
            );
          }

          if (plaintextHash) {
            assert.strictEqual(
              encryptedAttachment.plaintextHash,
              Bytes.toHex(plaintextHash)
            );
          }

          return decryptedAttachment;
        } finally {
          if (plaintextPath) {
            unlinkSync(plaintextPath);
          }
          if (ciphertextPath) {
            unlinkSync(ciphertextPath);
          }
        }
      }

      it('v2 roundtrips smaller file from disk', async () => {
        await testV2RoundTripData({
          path: FILE_PATH,
          data: FILE_CONTENTS,
          plaintextHash: FILE_HASH,
        });
      });

      it('v2 roundtrips smaller file from memory', async () => {
        await testV2RoundTripData({
          data: FILE_CONTENTS,
          plaintextHash: FILE_HASH,
        });

        // also works if data is raw Uint8Array rather than a buffer
        await testV2RoundTripData({
          data: new Uint8Array(FILE_CONTENTS),
          plaintextHash: FILE_HASH,
        });
      });

      it('v2 roundtrips large file from disk', async () => {
        const sourcePath = join(tempDir, 'random');
        // Get sufficient large file to have more than 64kb of padding and
        // trigger push back on the streams.
        const data = getRandomBytes(5 * 1024 * 1024);
        const plaintextHash = sha256(data);
        writeFileSync(sourcePath, data);
        try {
          await testV2RoundTripData({
            path: sourcePath,
            data,
            plaintextHash,
          });
        } finally {
          unlinkSync(sourcePath);
        }
      });
      it('v2 fails decrypt for large disk file if incrementalMac is wrong', async () => {
        const sourcePath = join(tempDir, 'random');
        const data = getRandomBytes(5 * 1024 * 1024);
        const plaintextHash = sha256(data);
        writeFileSync(sourcePath, data);
        try {
          await assert.isRejected(
            testV2RoundTripData({
              path: sourcePath,
              data,
              plaintextHash,
              modifyIncrementalMac: true,
            }),
            /Corrupted/
          );
        } finally {
          unlinkSync(sourcePath);
        }
      });

      it('v2 roundtrips large file from memory', async () => {
        // Get sufficient large data to have more than 64kb of padding and
        // trigger push back on the streams.
        const data = getRandomBytes(5 * 1024 * 1024);
        const plaintextHash = sha256(data);
        await testV2RoundTripData({
          data,
          plaintextHash,
        });
      });

      describe('isPaddingAllZeros', () => {
        it('detects all zeros', async () => {
          const decryptedResult = await testV2RoundTripData({
            data: FILE_CONTENTS,
          });
          assert.isTrue(decryptedResult.isReencryptableToSameDigest);
        });
        it('detects non-zero padding', async () => {
          const modifiedData = Buffer.concat([FILE_CONTENTS, Buffer.from([1])]);
          const decryptedResult = await testV2RoundTripData({
            data: modifiedData,
            overrideSize: FILE_CONTENTS.byteLength,
            // setting the size as one less than the actual file size will cause the last
            // byte (`1`) to be considered padding during decryption
          });
          assert.isFalse(decryptedResult.isReencryptableToSameDigest);
        });
      });
      describe('dangerousIv', () => {
        it('uses hardcodedIv in tests', async () => {
          await testV2RoundTripData({
            data: FILE_CONTENTS,
            plaintextHash: FILE_HASH,
            dangerousIv: {
              reason: 'test',
              iv: _generateAttachmentIv(),
            },
          });
        });

        it('uses hardcodedIv when re-encrypting for backup', async () => {
          const keys = generateAttachmentKeys();
          const previouslyEncrypted = await encryptAttachmentV2ToDisk({
            keys,
            plaintext: { data: FILE_CONTENTS },
            getAbsoluteAttachmentPath:
              window.Signal.Migrations.getAbsoluteAttachmentPath,
            needIncrementalMac: true,
          });

          await testV2RoundTripData({
            data: FILE_CONTENTS,
            plaintextHash: FILE_HASH,
            encryptionKeys: keys,
            dangerousIv: {
              reason: 'reencrypting-for-backup',
              iv: previouslyEncrypted.iv,
              digestToMatch: previouslyEncrypted.digest,
            },
          });

          // If the digest is wrong, it should throw
          await assert.isRejected(
            testV2RoundTripData({
              data: FILE_CONTENTS,
              plaintextHash: FILE_HASH,
              encryptionKeys: keys,
              dangerousIv: {
                reason: 'reencrypting-for-backup',
                iv: previouslyEncrypted.iv,
                digestToMatch: getRandomBytes(32),
              },
            }),
            'iv was hardcoded for backup re-encryption, but digest does not match'
          );
        });
      });
    });

    it('v2 -> v1 (disk -> memory)', async () => {
      const keys = generateAttachmentKeys();
      let ciphertextPath;

      try {
        const encryptedAttachment = await encryptAttachmentV2ToDisk({
          keys,
          plaintext: { absolutePath: FILE_PATH },
          getAbsoluteAttachmentPath:
            window.Signal.Migrations.getAbsoluteAttachmentPath,
          needIncrementalMac: false,
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

        const encryptedAttachmentV2 = await encryptAttachmentV2ToDisk({
          keys,
          plaintext: { absolutePath: FILE_PATH },
          dangerousIv: { iv: dangerousTestOnlyIv, reason: 'test' },
          getAbsoluteAttachmentPath:
            window.Signal.Migrations.getAbsoluteAttachmentPath,
          needIncrementalMac: false,
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

    describe('decryptAttachmentV2 with outer layer of encryption', () => {
      async function doubleEncrypt({
        plaintextAbsolutePath,
        innerKeys,
        outerKeys,
      }: {
        plaintextAbsolutePath: string;
        innerKeys: Uint8Array;
        outerKeys: Uint8Array;
      }) {
        let innerCiphertextPath;
        let outerCiphertextPath;
        let innerEncryptedAttachment;
        try {
          innerEncryptedAttachment = await encryptAttachmentV2ToDisk({
            keys: innerKeys,
            plaintext: { absolutePath: plaintextAbsolutePath },
            getAbsoluteAttachmentPath:
              window.Signal.Migrations.getAbsoluteAttachmentPath,
            needIncrementalMac: true,
          });
          innerCiphertextPath =
            window.Signal.Migrations.getAbsoluteAttachmentPath(
              innerEncryptedAttachment.path
            );

          const outerEncryptedAttachment = await encryptAttachmentV2ToDisk({
            keys: outerKeys,
            plaintext: { absolutePath: innerCiphertextPath },
            // We (and the server!) don't pad the second layer
            dangerousTestOnlySkipPadding: true,
            getAbsoluteAttachmentPath:
              window.Signal.Migrations.getAbsoluteAttachmentPath,
            needIncrementalMac: false,
          });

          outerCiphertextPath =
            window.Signal.Migrations.getAbsoluteAttachmentPath(
              outerEncryptedAttachment.path
            );
        } finally {
          if (innerCiphertextPath) {
            unlinkSync(innerCiphertextPath);
          }
        }
        return {
          outerCiphertextPath,
          innerEncryptedAttachment,
        };
      }

      it('v2 roundtrips smaller file (all on disk)', async () => {
        const outerKeys = generateAttachmentKeys();
        const innerKeys = generateAttachmentKeys();
        let plaintextPath;
        let outerCiphertextPath;

        try {
          const encryptResult = await doubleEncrypt({
            plaintextAbsolutePath: FILE_PATH,
            innerKeys,
            outerKeys,
          });
          outerCiphertextPath = encryptResult.outerCiphertextPath;

          const decryptedAttachment = await decryptAttachmentV2({
            type: 'standard',
            ciphertextPath: outerCiphertextPath,
            idForLogging: 'test',
            ...splitKeys(innerKeys),
            size: FILE_CONTENTS.byteLength,
            theirDigest: encryptResult.innerEncryptedAttachment.digest,
            theirIncrementalMac:
              encryptResult.innerEncryptedAttachment.incrementalMac,
            theirChunkSize: encryptResult.innerEncryptedAttachment.chunkSize,
            outerEncryption: splitKeys(outerKeys),
            getAbsoluteAttachmentPath:
              window.Signal.Migrations.getAbsoluteAttachmentPath,
          });

          plaintextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
            decryptedAttachment.path
          );
          const plaintext = readFileSync(plaintextPath);
          assert.isTrue(constantTimeEqual(FILE_CONTENTS, plaintext));
          assert.strictEqual(
            encryptResult.innerEncryptedAttachment.plaintextHash,
            GHOST_KITTY_HASH
          );
          assert.strictEqual(
            decryptedAttachment.plaintextHash,
            encryptResult.innerEncryptedAttachment.plaintextHash
          );
        } finally {
          if (plaintextPath) {
            unlinkSync(plaintextPath);
          }
          if (outerCiphertextPath) {
            unlinkSync(outerCiphertextPath);
          }
        }
      });

      it('v2 roundtrips random data (all on disk)', async () => {
        const sourcePath = join(tempDir, 'random');
        // Get sufficient large file to have more than 64kb of padding and
        // trigger push back on the streams.
        const data = getRandomBytes(5 * 1024 * 1024);

        writeFileSync(sourcePath, data);

        const outerKeys = generateAttachmentKeys();
        const innerKeys = generateAttachmentKeys();
        let plaintextPath;
        let outerCiphertextPath;

        try {
          const encryptResult = await doubleEncrypt({
            plaintextAbsolutePath: sourcePath,
            innerKeys,
            outerKeys,
          });
          outerCiphertextPath = encryptResult.outerCiphertextPath;

          const decryptedAttachment = await decryptAttachmentV2({
            type: 'standard',
            ciphertextPath: outerCiphertextPath,
            idForLogging: 'test',
            ...splitKeys(innerKeys),
            size: data.byteLength,
            theirDigest: encryptResult.innerEncryptedAttachment.digest,
            theirIncrementalMac:
              encryptResult.innerEncryptedAttachment.incrementalMac,
            theirChunkSize: encryptResult.innerEncryptedAttachment.chunkSize,
            outerEncryption: splitKeys(outerKeys),
            getAbsoluteAttachmentPath:
              window.Signal.Migrations.getAbsoluteAttachmentPath,
          });
          plaintextPath = window.Signal.Migrations.getAbsoluteAttachmentPath(
            decryptedAttachment.path
          );
          const plaintext = readFileSync(plaintextPath);
          assert.isTrue(constantTimeEqual(data, plaintext));
        } finally {
          if (sourcePath) {
            unlinkSync(sourcePath);
          }
          if (plaintextPath) {
            unlinkSync(plaintextPath);
          }
          if (outerCiphertextPath) {
            unlinkSync(outerCiphertextPath);
          }
        }
      });

      it('v2 fails if outer encryption mac is wrong', async () => {
        const sourcePath = join(tempDir, 'random');
        // Get sufficient large file to have more than 64kb of padding and
        // trigger push back on the streams.
        const data = getRandomBytes(5 * 1024 * 1024);

        writeFileSync(sourcePath, data);

        const outerKeys = generateAttachmentKeys();
        const innerKeys = generateAttachmentKeys();
        let outerCiphertextPath;

        try {
          const encryptResult = await doubleEncrypt({
            plaintextAbsolutePath: sourcePath,
            innerKeys,
            outerKeys,
          });
          outerCiphertextPath = encryptResult.outerCiphertextPath;

          await assert.isRejected(
            decryptAttachmentV2({
              type: 'standard',
              ciphertextPath: outerCiphertextPath,
              idForLogging: 'test',
              ...splitKeys(innerKeys),
              size: data.byteLength,
              theirDigest: encryptResult.innerEncryptedAttachment.digest,
              theirIncrementalMac:
                encryptResult.innerEncryptedAttachment.incrementalMac,
              theirChunkSize: encryptResult.innerEncryptedAttachment.chunkSize,
              outerEncryption: {
                aesKey: splitKeys(outerKeys).aesKey,
                macKey: splitKeys(innerKeys).macKey, // wrong mac!
              },
              getAbsoluteAttachmentPath:
                window.Signal.Migrations.getAbsoluteAttachmentPath,
            }),
            /Bad outer encryption MAC/
          );
        } finally {
          if (sourcePath) {
            unlinkSync(sourcePath);
          }
          if (outerCiphertextPath) {
            unlinkSync(outerCiphertextPath);
          }
        }
      });
    });
  });

  describe('getAesCbcCiphertextLength', () => {
    function encrypt(length: number) {
      const cipher = createCipheriv(
        CipherType.AES256CBC,
        getRandomBytes(32),
        getRandomBytes(16)
      );
      const encrypted = cipher.update(Buffer.alloc(length));
      return Buffer.concat([encrypted, cipher.final()]);
    }
    it('calculates cipherTextLength correctly', () => {
      for (let i = 0; i < 128; i += 1) {
        assert.strictEqual(getAesCbcCiphertextLength(i), encrypt(i).length);
      }
    });
  });
});
