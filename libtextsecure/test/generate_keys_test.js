/* global libsignal, textsecure */

describe('Key generation', function thisNeeded() {
  const count = 10;
  this.timeout(count * 2000);

  function validateStoredKeyPair(keyPair) {
    /* Ensure the keypair matches the format used internally by libsignal-protocol */
    assert.isObject(keyPair, 'Stored keyPair is not an object');
    assert.instanceOf(keyPair.pubKey, ArrayBuffer);
    assert.instanceOf(keyPair.privKey, ArrayBuffer);
    assert.strictEqual(keyPair.pubKey.byteLength, 33);
    assert.strictEqual(new Uint8Array(keyPair.pubKey)[0], 5);
    assert.strictEqual(keyPair.privKey.byteLength, 32);
  }
  function itStoresPreKey(keyId) {
    it(`prekey ${keyId} is valid`, () =>
      textsecure.storage.protocol.loadPreKey(keyId).then(keyPair => {
        validateStoredKeyPair(keyPair);
      }));
  }
  function itStoresSignedPreKey(keyId) {
    it(`signed prekey ${keyId} is valid`, () =>
      textsecure.storage.protocol.loadSignedPreKey(keyId).then(keyPair => {
        validateStoredKeyPair(keyPair);
      }));
  }
  function validateResultKey(resultKey) {
    return textsecure.storage.protocol
      .loadPreKey(resultKey.keyId)
      .then(keyPair => {
        assertEqualArrayBuffers(resultKey.publicKey, keyPair.pubKey);
      });
  }
  function validateResultSignedKey(resultSignedKey) {
    return textsecure.storage.protocol
      .loadSignedPreKey(resultSignedKey.keyId)
      .then(keyPair => {
        assertEqualArrayBuffers(resultSignedKey.publicKey, keyPair.pubKey);
      });
  }

  before(() => {
    localStorage.clear();
    return libsignal.KeyHelper.generateIdentityKeyPair().then(keyPair =>
      textsecure.storage.protocol.put('identityKey', keyPair)
    );
  });

  describe('the first time', () => {
    let result;
    /* result should have this format
         * {
         *   preKeys: [ { keyId, publicKey }, ... ],
         *   signedPreKey: { keyId, publicKey, signature },
         *   identityKey: <ArrayBuffer>
         * }
         */
    before(() => {
      const accountManager = new textsecure.AccountManager('');
      return accountManager.generateKeys(count).then(res => {
        result = res;
      });
    });
    for (let i = 1; i <= count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(1);

    it(`result contains ${count} preKeys`, () => {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      for (let i = 0; i < count; i += 1) {
        assert.strictEqual(result.preKeys[i].keyId, i + 1);
      }
    });
    it('result contains the correct public keys', () =>
      Promise.all(result.preKeys.map(validateResultKey)));
    it('returns a signed prekey', () => {
      assert.strictEqual(result.signedPreKey.keyId, 1);
      assert.instanceOf(result.signedPreKey.signature, ArrayBuffer);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe('the second time', () => {
    let result;
    before(() => {
      const accountManager = new textsecure.AccountManager('');
      return accountManager.generateKeys(count).then(res => {
        result = res;
      });
    });
    for (let i = 1; i <= 2 * count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(1);
    itStoresSignedPreKey(2);
    it(`result contains ${count} preKeys`, () => {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      for (let i = 1; i <= count; i += 1) {
        assert.strictEqual(result.preKeys[i - 1].keyId, i + count);
      }
    });
    it('result contains the correct public keys', () =>
      Promise.all(result.preKeys.map(validateResultKey)));
    it('returns a signed prekey', () => {
      assert.strictEqual(result.signedPreKey.keyId, 2);
      assert.instanceOf(result.signedPreKey.signature, ArrayBuffer);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
  describe('the third time', () => {
    let result;
    before(() => {
      const accountManager = new textsecure.AccountManager('');
      return accountManager.generateKeys(count).then(res => {
        result = res;
      });
    });
    for (let i = 1; i <= 3 * count; i += 1) {
      itStoresPreKey(i);
    }
    itStoresSignedPreKey(2);
    itStoresSignedPreKey(3);
    it(`result contains ${count} preKeys`, () => {
      assert.isArray(result.preKeys);
      assert.lengthOf(result.preKeys, count);
      for (let i = 0; i < count; i += 1) {
        assert.isObject(result.preKeys[i]);
      }
    });
    it('result contains the correct keyIds', () => {
      for (let i = 1; i <= count; i += 1) {
        assert.strictEqual(result.preKeys[i - 1].keyId, i + 2 * count);
      }
    });
    it('result contains the correct public keys', () =>
      Promise.all(result.preKeys.map(validateResultKey)));
    it('result contains a signed prekey', () => {
      assert.strictEqual(result.signedPreKey.keyId, 3);
      assert.instanceOf(result.signedPreKey.signature, ArrayBuffer);
      return validateResultSignedKey(result.signedPreKey);
    });
  });
});
