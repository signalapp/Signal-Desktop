/* global window, libsignal, textsecure, StringView, log */

// eslint-disable-next-line func-names
(function () {
  window.libloki = window.libloki || {};

  class FallBackDecryptionError extends Error { }

  const IV_LENGTH = 16;

  class FallBackSessionCipher {

    constructor(address) {
      this.identityKeyString = address.getName();
      this.pubKey = StringView.hexToArrayBuffer(address.getName());
    }

    async encrypt(plaintext) {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(this.pubKey, myPrivateKey);
      const iv = libsignal.crypto.getRandomBytes(IV_LENGTH);
      const ciphertext = await libsignal.crypto.encrypt(symmetricKey, plaintext, iv);
      const ivAndCiphertext = new Uint8Array(iv.byteLength + ciphertext.byteLength);
      ivAndCiphertext.set(new Uint8Array(iv));
      ivAndCiphertext.set(new Uint8Array(ciphertext), iv.byteLength);
      return {
        type: textsecure.protobuf.Envelope.Type.FALLBACK_CIPHERTEXT,
        body: ivAndCiphertext,
        registrationId: null,
      };
    }

    async decrypt(ivAndCiphertext) {
      const iv = ivAndCiphertext.slice(0, IV_LENGTH);
      const cipherText = ivAndCiphertext.slice(IV_LENGTH);
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(this.pubKey, myPrivateKey);
      try {
        return await libsignal.crypto.decrypt(symmetricKey, cipherText, iv);
      }
      catch (e) {
        throw new FallBackDecryptionError(`Could not decrypt message from ${this.identityKeyString} using FallBack encryption.`);
      }
    }
  }

  async function getPreKeyBundleForNumber(pubKey) {
    const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
    const identityKey = myKeyPair.pubKey;

    // Retrieve ids. The ids stored are always the latest generated + 1
    const signedKeyId = textsecure.storage.get('signedKeyId', 1) - 1;

    const [signedKey, preKey] = await Promise.all([
      textsecure.storage.protocol.loadSignedPreKey(signedKeyId),
      new Promise(async resolve => {
        // retrieve existing prekey if we already generated one for that recipient
        const storedPreKey = await textsecure.storage.protocol.loadPreKeyForContactIdentityKeyString(
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

    const preKeyMessage = new textsecure.protobuf.PreKeyBundleMessage({
      identityKey: new Uint8Array(identityKey),
      deviceId: 1, // TODO: fetch from somewhere
      preKeyId: preKey.keyId,
      signedKeyId,
      preKey: new Uint8Array(preKey.pubKey),
      signedKey: new Uint8Array(signedKey.pubKey),
      signature: new Uint8Array(signedKey.signature),
    });

    return preKeyMessage;
  }

  async function savePreKeyBundleForNumber({
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

  async function removePreKeyBundleForNumber(pubKey) {
    await Promise.all([
      textsecure.storage.protocol.removeContactPreKey(pubKey),
      textsecure.storage.protocol.removeContactSignedPreKey(pubKey),
    ]);
  }

  async function sendFriendRequestAccepted(pubKey) {
    // empty content message
    const content = new textsecure.protobuf.Content();

    // will be called once the transmission succeeded or failed
    const callback = res => {
      if (res.errors.length > 0) {
        res.errors.forEach(error => log.error(error));
      } else {
        log.info('empty message sent successfully');
      }
    };
    const options = {
      preKeyBundleType: textsecure.protobuf.PreKeyBundleMessage.Type.FRIEND_REQUEST_ACCEPT,
    };
    // send an empty message. The logic in ougoing_message will attach the prekeys.
    const outgoingMessage = new textsecure.OutgoingMessage(
      null, // server
      Date.now(), // timestamp,
      [pubKey], // numbers
      content, // message
      true, // silent
      callback, // callback
      options
    );
    await outgoingMessage.sendToNumber(pubKey);
  }

  window.libloki.FallBackSessionCipher = FallBackSessionCipher;
  window.libloki.getPreKeyBundleForNumber = getPreKeyBundleForNumber;
  window.libloki.FallBackDecryptionError = FallBackDecryptionError;
  window.libloki.savePreKeyBundleForNumber = savePreKeyBundleForNumber;
  window.libloki.removePreKeyBundleForNumber = removePreKeyBundleForNumber;
  window.libloki.sendFriendRequestAccepted = sendFriendRequestAccepted;
})();
