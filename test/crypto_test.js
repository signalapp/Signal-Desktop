'use strict';

describe('Crypto', function() {
  it('roundtrip symmetric encryption succeeds', async function() {
    var message = 'this is my message';
    var plaintext = new dcodeIO.ByteBuffer.wrap(
      message,
      'binary'
    ).toArrayBuffer();
    var key = textsecure.crypto.getRandomBytes(32);

    var encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
    var decrypted = await Signal.Crypto.decryptSymmetric(key, encrypted);

    var equal = Signal.Crypto.constantTimeEqual(plaintext, decrypted);
    if (!equal) {
      throw new Error('The output and input did not match!');
    }
  });

  it('roundtrip fails if nonce is modified', async function() {
    var message = 'this is my message';
    var plaintext = new dcodeIO.ByteBuffer.wrap(
      message,
      'binary'
    ).toArrayBuffer();
    var key = textsecure.crypto.getRandomBytes(32);

    var encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
    var uintArray = new Uint8Array(encrypted);
    uintArray[2] = 9;

    try {
      var decrypted = await Signal.Crypto.decryptSymmetric(
        key,
        uintArray.buffer
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

  it('fails if mac is modified', async function() {
    var message = 'this is my message';
    var plaintext = new dcodeIO.ByteBuffer.wrap(
      message,
      'binary'
    ).toArrayBuffer();
    var key = textsecure.crypto.getRandomBytes(32);

    var encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
    var uintArray = new Uint8Array(encrypted);
    uintArray[uintArray.length - 3] = 9;

    try {
      var decrypted = await Signal.Crypto.decryptSymmetric(
        key,
        uintArray.buffer
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

  it('fails if encrypted contents are modified', async function() {
    var message = 'this is my message';
    var plaintext = new dcodeIO.ByteBuffer.wrap(
      message,
      'binary'
    ).toArrayBuffer();
    var key = textsecure.crypto.getRandomBytes(32);

    var encrypted = await Signal.Crypto.encryptSymmetric(key, plaintext);
    var uintArray = new Uint8Array(encrypted);
    uintArray[35] = 9;

    try {
      var decrypted = await Signal.Crypto.decryptSymmetric(
        key,
        uintArray.buffer
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
