/* global libloki, Multibase, libsignal, StringView, dcodeIO */

'use strict';

async function generateSnodeKeysAndAddress() {
  // snode identitys is a ed25519 keypair
  const sodium = await window.getSodium();
  const ed25519KeyPair = sodium.crypto_sign_keypair();
  const keyPair = {
    pubKey: ed25519KeyPair.publicKey,
    privKey: ed25519KeyPair.privateKey,
  };
  // snode address is the pubkey in base32z
  let address = Multibase.encode(
    'base32z',
    Multibase.Buffer.from(keyPair.pubKey)
  ).toString();
  // remove first letter, which is the encoding code
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

  describe('#decodeSnodeAddressToPubKey', () => {
    it('should decode a base32z encoded .snode address', async () => {
      const { keyPair, address } = await generateSnodeKeysAndAddress();

      const buffer = libloki.crypto._decodeSnodeAddressToPubKey(
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

    it('should cache something by snode address', async () => {
      const { address } = await generateSnodeKeysAndAddress();

      const channel = new libloki.crypto._LokiSnodeChannel();
      // cache should be empty
      assert.strictEqual(Object.keys(channel._cache).length, 0);

      // push to cache
      await channel._getSymmetricKey(address);

      assert.strictEqual(Object.keys(channel._cache).length, 1);
      assert.strictEqual(Object.keys(channel._cache)[0], address);
    });

    it('should encrypt data correctly', async () => {
      // message sent by Session
      const snode = await generateSnodeKeysAndAddress();
      const messageSent = 'I am Groot';
      const textEncoder = new TextEncoder();
      const data = textEncoder.encode(messageSent);

      const channel = new libloki.crypto._LokiSnodeChannel();
      const encrypted = await channel.encrypt(snode.address, data);

      assert.strictEqual(typeof encrypted, 'string');

      // message received by storage server
      const senderPubKey = StringView.hexToArrayBuffer(
        channel.getChannelPublicKeyHex()
      );
      const sodium = await window.getSodium();
      const snodePrivKey = sodium.crypto_sign_ed25519_sk_to_curve25519(
        snode.keyPair.privKey
      ).buffer;
      const symmetricKey = libsignal.Curve.calculateAgreement(
        senderPubKey,
        snodePrivKey
      );
      const encryptedArrayBuffer = dcodeIO.ByteBuffer.wrap(
        encrypted,
        'base64'
      ).toArrayBuffer();
      const decrypted = await libloki.crypto.DHDecrypt(
        symmetricKey,
        encryptedArrayBuffer
      );
      const textDecoder = new TextDecoder();
      const messageReceived = textDecoder.decode(decrypted);
      assert.strictEqual(messageSent, messageReceived);
    });

    it('should decrypt data correctly', async () => {
      const channel = new libloki.crypto._LokiSnodeChannel();
      // message sent by storage server
      const snode = await generateSnodeKeysAndAddress();
      const messageSent = 'You are Groot';
      const textEncoder = new TextEncoder();
      const data = textEncoder.encode(messageSent);
      const senderPubKey = StringView.hexToArrayBuffer(
        channel.getChannelPublicKeyHex()
      );
      const sodium = await window.getSodium();
      const snodePrivKey = sodium.crypto_sign_ed25519_sk_to_curve25519(
        snode.keyPair.privKey
      ).buffer;
      const symmetricKey = libsignal.Curve.calculateAgreement(
        senderPubKey,
        snodePrivKey
      );
      const encrypted = await libloki.crypto.DHEncrypt(symmetricKey, data);
      const encryptedBase64 = dcodeIO.ByteBuffer.wrap(encrypted).toString(
        'base64'
      );
      // message received by Session
      const decrypted = await channel.decrypt(snode.address, encryptedBase64);
      assert.strictEqual(messageSent, decrypted);
    });
  });
});
