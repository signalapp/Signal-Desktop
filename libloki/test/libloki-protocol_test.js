/* global libsignal, libloki, textsecure, StringView */

'use strict';

describe('ConversationCollection', () => {
  let fallbackCipher;
  let identityKey;
  let testKey;
  let address;
  const store = textsecure.storage.protocol;

  beforeEach(async () => {
    clearDatabase();
    identityKey = await libsignal.KeyHelper.generateIdentityKeyPair();
    store.put('identityKey', identityKey);
    const key = libsignal.crypto.getRandomBytes(32);
    const pubKeyString = StringView.arrayBufferToHex(key);
    address = new libsignal.SignalProtocolAddress(
      pubKeyString,
      1 // sourceDevice
    );
    testKey = {
      pubKey: libsignal.crypto.getRandomBytes(33),
      privKey: libsignal.crypto.getRandomBytes(32),
    };
    fallbackCipher = new libloki.FallBackSessionCipher(address);
    textsecure.storage.put('maxPreKeyId', 0);
    textsecure.storage.put('signedKeyId', 2);
    await store.storeSignedPreKey(1, testKey);
  });

  it('should encrypt fallback cipher messages as friend requests', async () => {
    const buffer = new ArrayBuffer(10);
    const { type } = await fallbackCipher.encrypt(buffer);
    assert(type === textsecure.protobuf.Envelope.Type.FRIEND_REQUEST);
  });

  it('should should generate a new prekey bundle for a new contact', async () => {
    const pubKey = libsignal.crypto.getRandomBytes(32);
    const pubKeyString = StringView.arrayBufferToHex(pubKey);
    const preKeyIdBefore = textsecure.storage.get('maxPreKeyId', 1);
    const newBundle = await libloki.getPreKeyBundleForNumber(pubKeyString);
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
    const signedKeyArray = new Uint8Array(newBundle.signedKey.toArrayBuffer());
    assert.strictEqual(testKeyArray.byteLength, signedKeyArray.byteLength);
    for (let i = 0 ; i !== testKeyArray.byteLength ; i += 1)
      assert.strictEqual(testKeyArray[i], signedKeyArray[i]);
  });

  it('should should return the same prekey bundle after creating a contact', async () => {
    const pubKey = libsignal.crypto.getRandomBytes(32);
    const pubKeyString = StringView.arrayBufferToHex(pubKey);
    const bundle1 = await libloki.getPreKeyBundleForNumber(pubKeyString);
    const bundle2 = await libloki.getPreKeyBundleForNumber(pubKeyString);

    assert.isDefined(bundle1);
    assert.isDefined(bundle1.identityKey);
    assert.isDefined(bundle1.deviceId);
    assert.isDefined(bundle1.preKeyId);
    assert.isDefined(bundle1.signedKeyId);
    assert.isDefined(bundle1.preKey);
    assert.isDefined(bundle1.signedKey);
    assert.isDefined(bundle1.signature);

    assert.isDefined(bundle2);
    assert.isDefined(bundle2.identityKey);
    assert.isDefined(bundle2.deviceId);
    assert.isDefined(bundle2.preKeyId);
    assert.isDefined(bundle2.signedKeyId);
    assert.isDefined(bundle2.preKey);
    assert.isDefined(bundle2.signedKey);
    assert.isDefined(bundle2.signature);

    const identityKeyArray1 = new Uint8Array(bundle1.identityKey.toArrayBuffer());
    const identityKeyArray2 = new Uint8Array(bundle2.identityKey.toArrayBuffer());
    assert.strictEqual(identityKeyArray2.byteLength, identityKeyArray2.byteLength);
    for (let i = 0 ; i !== identityKeyArray2.byteLength ; i += 1)
      assert.strictEqual(identityKeyArray1[i], identityKeyArray2[i]);

    assert.strictEqual(bundle1.deviceId, bundle2.deviceId);
    assert.strictEqual(bundle1.preKeyId, bundle2.preKeyId);
    assert.strictEqual(bundle1.signedKeyId, bundle2.signedKeyId);

    const preKeyArray1 = new Uint8Array(bundle1.preKey.toArrayBuffer());
    const preKeyArray2 = new Uint8Array(bundle2.preKey.toArrayBuffer());
    assert.strictEqual(preKeyArray2.byteLength, preKeyArray2.byteLength);
    for (let i = 0 ; i !== preKeyArray2.byteLength ; i += 1)
      assert.strictEqual(preKeyArray1[i], preKeyArray2[i]);

    const signedKeyArray1 = new Uint8Array(bundle1.signedKey.toArrayBuffer());
    const signedKeyArray2 = new Uint8Array(bundle2.signedKey.toArrayBuffer());
    assert.strictEqual(signedKeyArray2.byteLength, signedKeyArray2.byteLength);
    for (let i = 0 ; i !== signedKeyArray2.byteLength ; i += 1)
      assert.strictEqual(signedKeyArray1[i], signedKeyArray2[i]);

    const signatureArray1 = new Uint8Array(bundle1.signature.toArrayBuffer());
    const signatureArray2 = new Uint8Array(bundle2.signature.toArrayBuffer());
    assert.strictEqual(signatureArray2.byteLength, signatureArray2.byteLength);
    for (let i = 0 ; i !== signatureArray2.byteLength ; i += 1)
      assert.strictEqual(signatureArray1[i], signatureArray2[i]);
  });
});
