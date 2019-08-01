/* global libsignal, libloki, textsecure, StringView */

'use strict';

describe('Storage', () => {
  let testKey;
  const store = textsecure.storage.protocol;

  describe('#getPreKeyBundleForContact', () => {
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
      const newBundle = await libloki.storage.getPreKeyBundleForContact(
        pubKeyString
      );
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
      assert.strictEqual(
        testKeyArray.byteLength,
        newBundle.signedKey.byteLength
      );
      for (let i = 0; i !== testKeyArray.byteLength; i += 1) {
        assert.strictEqual(testKeyArray[i], newBundle.signedKey[i]);
      }
    });

    it('should return the same prekey bundle after creating a contact', async () => {
      const pubKey = libsignal.crypto.getRandomBytes(32);
      const pubKeyString = StringView.arrayBufferToHex(pubKey);
      const bundle1 = await libloki.storage.getPreKeyBundleForContact(
        pubKeyString
      );
      const bundle2 = await libloki.storage.getPreKeyBundleForContact(
        pubKeyString
      );
      assert.isDefined(bundle1);
      assert.isDefined(bundle2);
      assert.deepEqual(bundle1, bundle2);
    });

    it('should save the signed keys and prekeys from a bundle', async () => {
      const pubKey = libsignal.crypto.getRandomBytes(32);
      const pubKeyString = StringView.arrayBufferToHex(pubKey);
      const preKeyIdBefore = textsecure.storage.get('maxPreKeyId', 1);
      const newBundle = await libloki.storage.getPreKeyBundleForContact(
        pubKeyString
      );
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
});
