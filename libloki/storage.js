/* global window, libsignal, textsecure */

// eslint-disable-next-line func-names
(function () {
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

  window.libloki.storage = {
    getPreKeyBundleForContact,
    saveContactPreKeyBundle,
    removeContactPreKeyBundle,
  };
})();
