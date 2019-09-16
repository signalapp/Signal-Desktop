/* global window, libsignal, textsecure */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  async function getPreKeyBundleForContact(pubKey) {
    const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
    const identityKey = myKeyPair.pubKey;

    // Retrieve ids. The ids stored are always the latest generated + 1
    const signedKeyId = textsecure.storage.get('signedKeyId', 2) - 1;

    const [signedKey, preKey] = await Promise.all([
      textsecure.storage.protocol.loadSignedPreKey(signedKeyId),
      new Promise(async resolve => {
        // retrieve existing prekey if we already generated one for that recipient
        const storedPreKey = await textsecure.storage.protocol.loadPreKeyForContact(
          pubKey
        );
        if (storedPreKey) {
          resolve({ pubKey: storedPreKey.pubKey, keyId: storedPreKey.keyId });
        } else {
          // generate and store new prekey
          const preKeyId = textsecure.storage.get('maxPreKeyId', 1);
          textsecure.storage.put('maxPreKeyId', preKeyId + 1);
          const newPreKey = await libsignal.KeyHelper.generatePreKey(preKeyId);
          await textsecure.storage.protocol.storePreKey(
            newPreKey.keyId,
            newPreKey.keyPair,
            pubKey
          );
          resolve({ pubKey: newPreKey.keyPair.pubKey, keyId: preKeyId });
        }
      }),
    ]);

    return {
      identityKey: new Uint8Array(identityKey),
      deviceId: 1, // TODO: fetch from somewhere
      preKeyId: preKey.keyId,
      signedKeyId,
      preKey: new Uint8Array(preKey.pubKey),
      signedKey: new Uint8Array(signedKey.pubKey),
      signature: new Uint8Array(signedKey.signature),
    };
  }

  async function saveContactPreKeyBundle({
    pubKey,
    preKeyId,
    preKey,
    signedKeyId,
    signedKey,
    signature,
  }) {
    const signedPreKey = {
      keyId: signedKeyId,
      publicKey: signedKey,
      signature,
    };

    const signedKeyPromise = textsecure.storage.protocol.storeContactSignedPreKey(
      pubKey,
      signedPreKey
    );

    const preKeyObject = {
      publicKey: preKey,
      keyId: preKeyId,
    };

    const preKeyPromise = textsecure.storage.protocol.storeContactPreKey(
      pubKey,
      preKeyObject
    );

    await Promise.all([signedKeyPromise, preKeyPromise]);
  }

  async function removeContactPreKeyBundle(pubKey) {
    await Promise.all([
      textsecure.storage.protocol.removeContactPreKey(pubKey),
      textsecure.storage.protocol.removeContactSignedPreKey(pubKey),
    ]);
  }

  async function verifyFriendRequestAcceptPreKey(pubKey, buffer) {
    const storedPreKey = await textsecure.storage.protocol.loadPreKeyForContact(
      pubKey
    );
    if (!storedPreKey) {
      throw new Error(
        'Received a friend request from a pubkey for which no prekey bundle was created'
      );
    }
    // need to pop the version
    // eslint-disable-next-line no-unused-vars
    const version = buffer.readUint8();
    const preKeyProto = window.textsecure.protobuf.PreKeyWhisperMessage.decode(
      buffer
    );
    if (!preKeyProto) {
      throw new Error(
        'Could not decode PreKeyWhisperMessage while attempting to match the preKeyId'
      );
    }
    const { preKeyId } = preKeyProto;
    if (storedPreKey.keyId !== preKeyId) {
      throw new Error(
        'Received a preKeyWhisperMessage (friend request accept) from an unknown source'
      );
    }
  }

  function savePairingAuthorisation(authorisation) {
    return window.Signal.Data.createOrUpdatePairingAuthorisation(authorisation);
  }

  function getGrantAuthorisationForSecondaryPubKey(secondaryPubKey) {
    return window.Signal.Data.getGrantAuthorisationForPubKey(secondaryPubKey);
  }

  function getAuthorisationForSecondaryPubKey(secondaryPubKey) {
    return window.Signal.Data.getAuthorisationForPubKey(secondaryPubKey);
  }

  function getSecondaryDevicesFor(primaryDevicePubKey) {
    return window.Signal.Data.getSecondaryDevicesFor(primaryDevicePubKey);
  }

  async function getAllDevicePubKeysForPrimaryPubKey(primaryDevicePubKey) {
    const secondaryPubKeys =
      (await getSecondaryDevicesFor(primaryDevicePubKey)) || [];
    return secondaryPubKeys.concat(primaryDevicePubKey);
  }

  window.libloki.storage = {
    getPreKeyBundleForContact,
    saveContactPreKeyBundle,
    removeContactPreKeyBundle,
    verifyFriendRequestAcceptPreKey,
    savePairingAuthorisation,
    getGrantAuthorisationForSecondaryPubKey,
    getAuthorisationForSecondaryPubKey,
    getAllDevicePubKeysForPrimaryPubKey,
    getSecondaryDevicesFor,
  };

  // Libloki protocol store

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
    const preKey = await window.Signal.Data.getContactPreKeyByIdentityKey(
      pubKey
    );
    if (preKey) {
      return {
        id: preKey.id,
        keyId: preKey.keyId,
        publicKey: preKey.publicKey,
        identityKeyString: preKey.identityKeyString,
      };
    }

    window.log.warn('Failed to fetch contact prekey:', pubKey);
    return undefined;
  };

  store.loadContactPreKeys = async filters => {
    const { keyId, identityKeyString } = filters;
    const keys = await window.Signal.Data.getContactPreKeys(
      keyId,
      identityKeyString
    );
    if (keys) {
      return keys.map(preKey => ({
        id: preKey.id,
        keyId: preKey.keyId,
        publicKey: preKey.publicKey,
        identityKeyString: preKey.identityKeyString,
      }));
    }

    window.log.warn('Failed to fetch signed prekey with filters', filters);
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
    const preKey = await window.Signal.Data.getContactSignedPreKeyByIdentityKey(
      pubKey
    );
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
    const keys = await window.Signal.Data.getContactSignedPreKeys(
      keyId,
      identityKeyString
    );
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
