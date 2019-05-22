/* global libsignal, textsecure */

describe('SignalProtocolStore', () => {
  before(() => {
    localStorage.clear();
  });
  const store = textsecure.storage.protocol;
  const identifier = '+5558675309';
  const identityKey = {
    pubKey: libsignal.crypto.getRandomBytes(33),
    privKey: libsignal.crypto.getRandomBytes(32),
  };
  const testKey = {
    pubKey: libsignal.crypto.getRandomBytes(33),
    privKey: libsignal.crypto.getRandomBytes(32),
  };
  it('retrieves my registration id', async () => {
    store.put('registrationId', 1337);

    const reg = await store.getLocalRegistrationId();
    assert.strictEqual(reg, 1337);
  });
  it('retrieves my identity key', async () => {
    store.put('identityKey', identityKey);
    const key = await store.getIdentityKeyPair();
    assertEqualArrayBuffers(key.pubKey, identityKey.pubKey);
    assertEqualArrayBuffers(key.privKey, identityKey.privKey);
  });
  it('stores identity keys', async () => {
    await store.saveIdentity(identifier, testKey.pubKey);
    const key = await store.loadIdentityKey(identifier);
    assertEqualArrayBuffers(key, testKey.pubKey);
  });
  it('returns whether a key is trusted', async () => {
    const newIdentity = libsignal.crypto.getRandomBytes(33);
    await store.saveIdentity(identifier, testKey.pubKey);

    const trusted = await store.isTrustedIdentity(identifier, newIdentity);
    if (trusted) {
      throw new Error('Allowed to overwrite identity key');
    }
  });
  it('returns whether a key is untrusted', async () => {
    await store.saveIdentity(identifier, testKey.pubKey);
    const trusted = await store.isTrustedIdentity(identifier, testKey.pubKey);

    if (!trusted) {
      throw new Error('Allowed to overwrite identity key');
    }
  });
  it('stores prekeys', async () => {
    await store.storePreKey(1, testKey);

    const key = await store.loadPreKey(1);
    assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
    assertEqualArrayBuffers(key.privKey, testKey.privKey);
  });
  it('deletes prekeys', async () => {
    await store.storePreKey(2, testKey);
    await store.removePreKey(2, testKey);

    const key = await store.loadPreKey(2);
    assert.isUndefined(key);
  });
  it('stores signed prekeys', async () => {
    await store.storeSignedPreKey(3, testKey);

    const key = await store.loadSignedPreKey(3);
    assertEqualArrayBuffers(key.pubKey, testKey.pubKey);
    assertEqualArrayBuffers(key.privKey, testKey.privKey);
  });
  it('deletes signed prekeys', async () => {
    await store.storeSignedPreKey(4, testKey);
    await store.removeSignedPreKey(4, testKey);

    const key = await store.loadSignedPreKey(4);
    assert.isUndefined(key);
  });
  it('stores sessions', async () => {
    const testRecord = 'an opaque string';
    const devices = [1, 2, 3].map(deviceId => [identifier, deviceId].join('.'));

    await Promise.all(
      devices.map(async encodedNumber => {
        await store.storeSession(encodedNumber, testRecord + encodedNumber);
      })
    );

    const records = await Promise.all(
      devices.map(store.loadSession.bind(store))
    );

    for (let i = 0, max = records.length; i < max; i += 1) {
      assert.strictEqual(records[i], testRecord + devices[i]);
    }
  });
  it('removes all sessions for a number', async () => {
    const testRecord = 'an opaque string';
    const devices = [1, 2, 3].map(deviceId => [identifier, deviceId].join('.'));

    await Promise.all(
      devices.map(async encodedNumber => {
        await store.storeSession(encodedNumber, testRecord + encodedNumber);
      })
    );

    await store.removeAllSessions(identifier);

    const records = await Promise.all(
      devices.map(store.loadSession.bind(store))
    );

    for (let i = 0, max = records.length; i < max; i += 1) {
      assert.isUndefined(records[i]);
    }
  });
  it('returns deviceIds for a number', async () => {
    const testRecord = 'an opaque string';
    const devices = [1, 2, 3].map(deviceId => [identifier, deviceId].join('.'));

    await Promise.all(
      devices.map(async encodedNumber => {
        await store.storeSession(encodedNumber, testRecord + encodedNumber);
      })
    );

    const deviceIds = await store.getDeviceIds(identifier);
    assert.sameMembers(deviceIds, [1, 2, 3]);
  });
  it('returns empty array for a number with no device ids', async () => {
    const deviceIds = await store.getDeviceIds('foo');
    assert.sameMembers(deviceIds, []);
  });
});
