/* global libloki, Multibase, libsignal, StringView */

'use strict';

function generateSnodeKeysAndAddress() {
  const keyPair = libsignal.Curve.generateKeyPair();
  // Signal protocol prepends with "0x05"
  keyPair.pubKey = keyPair.pubKey.slice(1);
  let address = Multibase.encode(
    'base32z',
    Multibase.Buffer.from(keyPair.pubKey)
  ).toString();
  // first letter is the encoding code
  address = address.substring(1);
  return { keyPair, address };
}

describe('Snode Channel', () => {
  describe('snodeCipher singleton', () => {
    it('should be defined at libloki.crypto', () => {
      assert.isDefined(libloki.crypto.snodeCipher);
      assert.isTrue(
        libloki.crypto.snodeCipher instanceof libloki.crypto._LokiSnodeChannel
      );
    });
  });

  describe('#decodeSnodeAddressToBuffer', () => {
    it('should decode a base32z encoded .snode address', () => {
      const { keyPair, address } = generateSnodeKeysAndAddress();

      const buffer = libloki.crypto._decodeSnodeAddressToBuffer(
        `http://${address}.snode`
      );

      const expected = new Uint8Array(keyPair.pubKey);
      assert.strictEqual(expected.length, 32);
      assert.strictEqual(buffer.length, 32);
      for (let i = 0; i < buffer.length; i += 1) {
        assert.strictEqual(buffer[i], expected[i]);
      }
    });
  });

  describe('#LokiSnodeChannel', () => {
    it('should generate an ephemeral key pair', () => {
      const channel = new libloki.crypto._LokiSnodeChannel();

      assert.isDefined(channel._ephemeralKeyPair);
      assert.isTrue(channel._ephemeralKeyPair.privKey instanceof ArrayBuffer);
      assert.isTrue(channel._ephemeralKeyPair.pubKey instanceof ArrayBuffer);
      const pubKeyHex = StringView.arrayBufferToHex(
        channel._ephemeralKeyPair.pubKey
      );
      assert.strictEqual(channel.getChannelPublicKeyHex(), pubKeyHex);
    });

    it('should cache something by snode address', () => {
      const { address } = generateSnodeKeysAndAddress();

      const channel = new libloki.crypto._LokiSnodeChannel();
      // cache should be empty
      assert.strictEqual(Object.keys(channel._cache).length, 0);

      // push to cache
      channel._getSymmetricKey(address);

      assert.strictEqual(Object.keys(channel._cache).length, 1);
      assert.strictEqual(Object.keys(channel._cache)[0], address);
    });

    it('should encrypt data correctly', async () => {
      // message sent by Loki Messenger
      const snode = generateSnodeKeysAndAddress();
      const messageSent = 'I am Groot';
      const textEncoder = new TextEncoder();
      const data = textEncoder.encode(messageSent);

      const channel = new libloki.crypto._LokiSnodeChannel();
      const encrypted = await channel.encrypt(snode.address, data);

      assert.isTrue(encrypted instanceof Uint8Array);

      // message received by storage server
      const senderPubKey = StringView.hexToArrayBuffer(
        channel.getChannelPublicKeyHex()
      );
      const symmetricKey = libsignal.Curve.calculateAgreement(
        senderPubKey,
        snode.keyPair.privKey
      );
      const decrypted = await libloki.crypto.DHDecrypt(symmetricKey, encrypted);
      const textDecoder = new TextDecoder();
      const messageReceived = textDecoder.decode(decrypted);
      assert.strictEqual(messageSent, messageReceived);
    });

    it('should decrypt data correctly', async () => {
      const channel = new libloki.crypto._LokiSnodeChannel();
      // message sent by storage server
      const snode = generateSnodeKeysAndAddress();
      const messageSent = 'You are Groot';
      const textEncoder = new TextEncoder();
      const data = textEncoder.encode(messageSent);
      const senderPubKey = StringView.hexToArrayBuffer(
        channel.getChannelPublicKeyHex()
      );
      const symmetricKey = libsignal.Curve.calculateAgreement(
        senderPubKey,
        snode.keyPair.privKey
      );
      const encrypted = await libloki.crypto.DHEncrypt(symmetricKey, data);

      // message received by Loki Messenger
      const decrypted = await channel.decrypt(snode.address, encrypted);
      const textDecoder = new TextDecoder();
      const messageReceived = textDecoder.decode(decrypted);
      assert.strictEqual(messageSent, messageReceived);
    });
  });
});
