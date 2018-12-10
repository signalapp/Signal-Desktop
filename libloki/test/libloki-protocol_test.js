/* global libsignal, libloki, textsecure, StringView */

'use strict';

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
    address = new libsignal.SignalProtocolAddress(
      pubKeyString,
      1
    );
    fallbackCipher = new libloki.FallBackSessionCipher(address);
  });

  it('should encrypt fallback cipher messages as friend requests', async () => {
    const buffer = new ArrayBuffer(10);
    const { type } = await fallbackCipher.encrypt(buffer);
    assert.strictEqual(type, textsecure.protobuf.Envelope.Type.FRIEND_REQUEST);
  });

  it('should encrypt and then decrypt a message with the same result', async () => {
    const arr = new Uint8Array([1,2,3,4,5]);
    const { body } = await fallbackCipher.encrypt(arr.buffer);
    const result = await fallbackCipher.decrypt(body);
    assert.deepEqual(result, arr.buffer);
  });
});

describe('LibLoki Protocol', () => {
  let testKey;
  const store = textsecure.storage.protocol;

  beforeEach(async () => {
    clearDatabase();
    testKey = {
      pubKey: libsignal.crypto.getRandomBytes(33),
      privKey: libsignal.crypto.getRandomBytes(32),
    };
    textsecure.storage.put('signedKeyId', 2);
    await store.storeSignedPreKey(1, testKey);
  });

  it('should generate a new prekey bundle for a new contact', async () => {
    const pubKey = libsignal.crypto.getRandomBytes(32);
    const pubKeyString = StringView.arrayBufferToHex(pubKey);
    const preKeyIdBefore = textsecure.storage.get('maxPreKeyId', 1);
    const newBundle = await libloki.getPreKeyBundleForContact(pubKeyString);
    const preKeyIdAfter = textsecure.storage.get('maxPreKeyId', 1);
    assert.strictEqual(preKeyIdAfter, preKeyIdBefore + 1);

    const testKeyArray = new Uint8Array(testKey.pubKey);
    assert.isDefined(newBundle);
    assert.isDefined(newBundle.identityKey);
    assert.isDefined(newBundle.deviceId);
    assert.isDefined(newBundle.preKeyId);
    assert.isDefined(newBundle.signedKeyId);
    assert.isDefined(newBundle.preKey);
    assert.isDefined(newBundle.signedKey);
    assert.isDefined(newBundle.signature);
    assert.strictEqual(testKeyArray.byteLength, newBundle.signedKey.byteLength);
    for (let i = 0 ; i !== testKeyArray.byteLength; i += 1)
      assert.strictEqual(testKeyArray[i], newBundle.signedKey[i]);
  });

  it('should return the same prekey bundle after creating a contact', async () => {
    const pubKey = libsignal.crypto.getRandomBytes(32);
    const pubKeyString = StringView.arrayBufferToHex(pubKey);
    const bundle1 = await libloki.getPreKeyBundleForContact(pubKeyString);
    const bundle2 = await libloki.getPreKeyBundleForContact(pubKeyString);
    assert.isDefined(bundle1);
    assert.isDefined(bundle2);
    assert.deepEqual(bundle1, bundle2);
  });

  it('should save the signed keys and prekeys from a bundle', async () => {
    const pubKey = libsignal.crypto.getRandomBytes(32);
    const pubKeyString = StringView.arrayBufferToHex(pubKey);
    const preKeyIdBefore = textsecure.storage.get('maxPreKeyId', 1);
    const newBundle = await libloki.getPreKeyBundleForContact(pubKeyString);
    const preKeyIdAfter = textsecure.storage.get('maxPreKeyId', 1);
    assert.strictEqual(preKeyIdAfter, preKeyIdBefore + 1);

    const testKeyArray = new Uint8Array(testKey.pubKey);
    assert.isDefined(newBundle);
    assert.isDefined(newBundle.identityKey);
    assert.isDefined(newBundle.deviceId);
    assert.isDefined(newBundle.preKeyId);
    assert.isDefined(newBundle.signedKeyId);
    assert.isDefined(newBundle.preKey);
    assert.isDefined(newBundle.signedKey);
    assert.isDefined(newBundle.signature);
    assert.deepEqual(testKeyArray, newBundle.signedKey);
  });
});
