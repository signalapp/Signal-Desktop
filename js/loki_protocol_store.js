// eslint-disable-next-line func-names
(function() {
  'use strict';

  const store = window.SignalProtocolStore.prototype;

  store.storeContactPreKey = async (pubKey, preKey) => {
    const key = {
      // id: (autoincrement)
      identityKeyString: pubKey,
      publicKey: preKey.publicKey,
      keyId: preKey.keyId,
    };

    await window.Signal.Data.createOrUpdateContactPreKey(key);
  };

  store.loadContactPreKey = async pubKey => {
    const preKey = await window.Signal.Data.getContactPreKeyByIdentityKey(pubKey);
    if (preKey) {
      return {
        id: preKey.id,
        keyId: preKey.keyId,
        publicKey: preKey.publicKey,
        identityKeyString: preKey.identityKeyString,
      }
    }

    window.log.warn('Failed to fetch contact prekey:', pubKey);
    return undefined;
  };

  store.loadContactPreKeys = async filters => {
    const { keyId, identityKeyString } = filters;
    const keys = await window.Signal.Data.getContactPreKeys(keyId, identityKeyString);
    if (keys) {
      return keys.map(preKey => ({
        id: preKey.id,
        keyId: preKey.keyId,
        publicKey: preKey.publicKey,
        identityKeyString: preKey.identityKeyString,
      }));
    }

    window.log.warn(
      'Failed to fetch signed prekey with filters',
      filters
    );
    return undefined;
  };

  store.removeContactPreKey = async pubKey => {
    await window.Signal.Data.removeContactPreKeyByIdentityKey(pubKey);
  };

  store.clearContactPreKeysStore = async () => {
    await window.Signal.Data.removeAllContactPreKeys();
  };

  store.storeContactSignedPreKey = async (pubKey, signedPreKey) => {
    const key = {
      // id: (autoincrement)
      identityKeyString: pubKey,
      keyId: signedPreKey.keyId,
      publicKey: signedPreKey.publicKey,
      signature: signedPreKey.signature,
      created_at: Date.now(),
      confirmed: false,
    };
    await window.Signal.Data.createOrUpdateContactSignedPreKey(key);
  };

  store.loadContactSignedPreKey = async pubKey => {
    const preKey = await window.Signal.Data.getContactSignedPreKeyByIdentityKey(pubKey);
    if (preKey) {
      return {
        id: preKey.id,
        identityKeyString: preKey.identityKeyString,
        publicKey: preKey.publicKey,
        signature: preKey.signature,
        created_at: preKey.created_at,
        keyId: preKey.keyId,
        confirmed: preKey.confirmed,
      };
    }
    window.log.warn('Failed to fetch contact signed prekey:', pubKey);
    return undefined;
  };

  store.loadContactSignedPreKeys = async filters => {
    const { keyId, identityKeyString } = filters;
    const keys = await window.Signal.Data.getContactSignedPreKeys(keyId, identityKeyString);
    if (keys) {
      return keys.map(preKey => ({
        id: preKey.id,
        identityKeyString: preKey.identityKeyString,
        publicKey: preKey.publicKey,
        signature: preKey.signature,
        created_at: preKey.created_at,
        keyId: preKey.keyId,
        confirmed: preKey.confirmed,
      }));
    }

    window.log.warn(
      'Failed to fetch contact signed prekey with filters',
      filters
    );
    return undefined;
  };

  store.removeContactSignedPreKey = async pubKey => {
    await window.Signal.Data.removeContactSignedPreKeyByIdentityKey(pubKey);
  };

  store.clearContactSignedPreKeysStore = async () => {
    await window.Signal.Data.removeAllContactSignedPreKeys();
  };

})();
