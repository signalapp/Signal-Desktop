// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global libsignal, textsecure */

describe('encrypting and decrypting profile data', () => {
  const NAME_PADDED_LENGTH = 53;
  describe('encrypting and decrypting profile names', () => {
    it('pads, encrypts, decrypts, and unpads a short string', () => {
      const name = 'Alice';
      const buffer = dcodeIO.ByteBuffer.wrap(name).toArrayBuffer();
      const key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto
        .encryptProfileName(buffer, key)
        .then(encrypted => {
          assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
          return textsecure.crypto
            .decryptProfileName(encrypted, key)
            .then(({ given, family }) => {
              assert.strictEqual(family, null);
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(given).toString('utf8'),
                name
              );
            });
        });
    });
    it('handles a given name of the max, 53 characters', () => {
      const name = '01234567890123456789012345678901234567890123456789123';
      const buffer = dcodeIO.ByteBuffer.wrap(name).toArrayBuffer();
      const key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto
        .encryptProfileName(buffer, key)
        .then(encrypted => {
          assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
          return textsecure.crypto
            .decryptProfileName(encrypted, key)
            .then(({ given, family }) => {
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(given).toString('utf8'),
                name
              );
              assert.strictEqual(family, null);
            });
        });
    });
    it('handles family/given name of the max, 53 characters', () => {
      const name = '01234567890123456789\u000001234567890123456789012345678912';
      const buffer = dcodeIO.ByteBuffer.wrap(name).toArrayBuffer();
      const key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto
        .encryptProfileName(buffer, key)
        .then(encrypted => {
          assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
          return textsecure.crypto
            .decryptProfileName(encrypted, key)
            .then(({ given, family }) => {
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(given).toString('utf8'),
                '01234567890123456789'
              );
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(family).toString('utf8'),
                '01234567890123456789012345678912'
              );
            });
        });
    });
    it('handles a string with family/given name', () => {
      const name = 'Alice\0Jones';
      const buffer = dcodeIO.ByteBuffer.wrap(name).toArrayBuffer();
      const key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto
        .encryptProfileName(buffer, key)
        .then(encrypted => {
          assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
          return textsecure.crypto
            .decryptProfileName(encrypted, key)
            .then(({ given, family }) => {
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(given).toString('utf8'),
                'Alice'
              );
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(family).toString('utf8'),
                'Jones'
              );
            });
        });
    });
    it('works for empty string', () => {
      const name = dcodeIO.ByteBuffer.wrap('').toArrayBuffer();
      const key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto
        .encryptProfileName(name.buffer, key)
        .then(encrypted => {
          assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
          return textsecure.crypto
            .decryptProfileName(encrypted, key)
            .then(({ given, family }) => {
              assert.strictEqual(family, null);
              assert.strictEqual(given.byteLength, 0);
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(given).toString('utf8'),
                ''
              );
            });
        });
    });
  });
  describe('encrypting and decrypting profile avatars', () => {
    it('encrypts and decrypts', () => {
      const buffer = dcodeIO.ByteBuffer.wrap(
        'This is an avatar'
      ).toArrayBuffer();
      const key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto.encryptProfile(buffer, key).then(encrypted => {
        assert(encrypted.byteLength === buffer.byteLength + 16 + 12);
        return textsecure.crypto
          .decryptProfile(encrypted, key)
          .then(decrypted => {
            assertEqualArrayBuffers(buffer, decrypted);
          });
      });
    });
    it('throws when decrypting with the wrong key', () => {
      const buffer = dcodeIO.ByteBuffer.wrap(
        'This is an avatar'
      ).toArrayBuffer();
      const key = libsignal.crypto.getRandomBytes(32);
      const badKey = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto.encryptProfile(buffer, key).then(encrypted => {
        assert(encrypted.byteLength === buffer.byteLength + 16 + 12);
        return textsecure.crypto
          .decryptProfile(encrypted, badKey)
          .catch(error => {
            assert.strictEqual(error.name, 'ProfileDecryptError');
          });
      });
    });
  });
});
