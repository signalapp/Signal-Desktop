/* global libsignal, libloki, textsecure, StringView, dcodeIO */

'use strict';

describe('Crypto', () => {
  describe('FallBackSessionCipher', () => {
    let fallbackCipher;
    let identityKey;
    let address;
    const store = textsecure.storage.protocol;

    before(async () => {
      clearDatabase();
      identityKey = await libsignal.KeyHelper.generateIdentityKeyPair();
      store.put('identityKey', identityKey);
      const key = libsignal.crypto.getRandomBytes(32);
      const pubKeyString = StringView.arrayBufferToHex(key);
      address = new libsignal.SignalProtocolAddress(pubKeyString, 1);
      fallbackCipher = new libloki.crypto.FallBackSessionCipher(address);
    });

    it('should encrypt fallback cipher messages as friend requests', async () => {
      const buffer = new ArrayBuffer(10);
      const { type } = await fallbackCipher.encrypt(buffer);
      assert.strictEqual(
        type,
        textsecure.protobuf.Envelope.Type.SESSION_REQUEST
      );
    });

    it('should encrypt and then decrypt a message with the same result', async () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5]);
      const { body } = await fallbackCipher.encrypt(arr.buffer);
      const bufferBody = dcodeIO.ByteBuffer.wrap(
        body,
        'binary'
      ).toArrayBuffer();
      const result = await fallbackCipher.decrypt(bufferBody);
      assert.deepEqual(result, arr.buffer);
    });
  });
});
