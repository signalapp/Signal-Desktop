/* global libsignal, textsecure */

describe('encrypting and decrypting profile data', () => {
  const NAME_PADDED_LENGTH = 26;
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
            .then(decrypted => {
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8'),
                'Alice'
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
            .then(decrypted => {
              assert.strictEqual(decrypted.byteLength, 0);
              assert.strictEqual(
                dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8'),
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
