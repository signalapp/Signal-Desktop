describe('encrypting and decrypting profile data', function() {
  it('works', function() {
    var NAME_PADDED_LENGTH = 26;
    var input = new Uint8Array(NAME_PADDED_LENGTH);
    input.set(new Uint8Array(dcodeIO.ByteBuffer.wrap('Alice').toArrayBuffer()));

    var key = libsignal.crypto.getRandomBytes(32);

    return textsecure.crypto.encryptProfile(input.buffer, key).then(function(encrypted) {
      assert(encrypted.byteLength === input.buffer.byteLength + 16 + 12);
      return textsecure.crypto.decryptProfile(encrypted, key).then(function(decrypted) {
        assertEqualArrayBuffers(input.buffer, decrypted)
      });
    });
  });
});
