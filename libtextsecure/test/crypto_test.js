describe('encrypting and decrypting profile data', function() {
  var NAME_PADDED_LENGTH = 26;
  describe('encrypting and decrypting profile names', function() {
    it('pads, encrypts, decrypts, and unpads a short string', function() {
      var name = 'Alice';
      var buffer = dcodeIO.ByteBuffer.wrap(name).toArrayBuffer();
      var key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto.encryptProfileName(buffer, key).then(function(encrypted) {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return textsecure.crypto.decryptProfileName(encrypted, key).then(function(decrypted) {
          assert.strictEqual(dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8'), 'Alice');
        });
      });
    });
    it('works for empty string', function() {
      var name = dcodeIO.ByteBuffer.wrap('').toArrayBuffer();
      var key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto.encryptProfileName(name.buffer, key).then(function(encrypted) {
        assert(encrypted.byteLength === NAME_PADDED_LENGTH + 16 + 12);
        return textsecure.crypto.decryptProfileName(encrypted, key).then(function(decrypted) {
          assert.strictEqual(decrypted.byteLength, 0);
          assert.strictEqual(dcodeIO.ByteBuffer.wrap(decrypted).toString('utf8'), '');
        });
      });
    });
  });
  describe('encrypting and decrypting profile avatars', function() {
    it('encrypts and decrypts', function() {
      var buffer = dcodeIO.ByteBuffer.wrap('This is an avatar').toArrayBuffer();
      var key = libsignal.crypto.getRandomBytes(32);

      return textsecure.crypto.encryptProfile(buffer, key).then(function(encrypted) {
        assert(encrypted.byteLength === buffer.byteLength + 16 + 12);
        return textsecure.crypto.decryptProfile(encrypted, key).then(function(decrypted) {
          assertEqualArrayBuffers(buffer, decrypted)
        });
      });
    });
  });
});
