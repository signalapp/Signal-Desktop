/* global window, libsignal, textsecure */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  class FallBackDecryptionError extends Error {}

  const IV_LENGTH = 16;

  FallBackSessionCipher = function (address) {
    this.identityKeyString = address.getName();
    this.pubKey = StringView.hexToArrayBuffer(address.getName());

    this.encrypt = async (plaintext) => {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(this.pubKey, myPrivateKey);
      const iv = libsignal.crypto.getRandomBytes(IV_LENGTH);
      const ciphertext = await libsignal.crypto.encrypt(symmetricKey, plaintext, iv);
      const ivAndCiphertext = new Uint8Array(
        iv.byteLength + ciphertext.byteLength
      );
      ivAndCiphertext.set(new Uint8Array(iv));
      ivAndCiphertext.set(
        new Uint8Array(ciphertext),
        iv.byteLength
      );

      return {
          type           : 6, //friend request
          body           : ivAndCiphertext,
          registrationId : null
      };
    },

    this.decrypt = async (ivAndCiphertext) => {
      const iv = ivAndCiphertext.slice(0, IV_LENGTH);
      const cipherText = ivAndCiphertext.slice(IV_LENGTH);
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(this.pubKey, myPrivateKey);
      try {
        return await libsignal.crypto.decrypt(symmetricKey, cipherText, iv);
      } catch(e) {
        throw new FallBackDecryptionError('Could not decrypt message from ' + this.identityKeyString + ' using FallBack encryption.')
      }
    }
  }

  getPreKeyBundleForNumber = async function(pubKey) {
    const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
    const identityKey = myKeyPair.pubKey;

    // Retrieve ids. The ids stored are always the latest generated + 1
    const signedKeyId = textsecure.storage.get('signedKeyId', 1) - 1;
    
    const [signedKey, preKey] = await Promise.all([
      textsecure.storage.protocol.loadSignedPreKey(signedKeyId),
      new Promise(async (resolve, reject) => {
        // retrieve existing prekey if we already generated one for that recipient
        const storedPreKey = await textsecure.storage.protocol.loadPreKeyForContactIdentityKeyString(pubKey);
        if (storedPreKey) {
          resolve({ pubKey: storedPreKey.pubKey, keyId: storedPreKey.keyId });
        } else {
          // generate and store new prekey
          const preKeyId = textsecure.storage.get('maxPreKeyId', 1);
          textsecure.storage.put('maxPreKeyId', preKeyId + 1);
          const preKey = await libsignal.KeyHelper.generatePreKey(preKeyId);
          await textsecure.storage.protocol.storePreKey(preKey.keyId, preKey.keyPair, pubKey);
          resolve({ pubKey: preKey.keyPair.pubKey, keyId: preKeyId });
        }
      })
    ]);

    const preKeyMessage = new textsecure.protobuf.PreKeyBundleMessage({
      identityKey,
	    deviceId: 1,        // TODO: fetch from somewhere
	    preKeyId: preKey.keyId,
	    signedKeyId,
      preKey: preKey.pubKey,
      signedKey: signedKey.pubKey,
      signature: signedKey.signature,
    });

    return preKeyMessage;
  }
  
  window.libloki.FallBackSessionCipher = FallBackSessionCipher;
  window.libloki.getPreKeyBundleForNumber = getPreKeyBundleForNumber;
  window.libloki.FallBackDecryptionError = FallBackDecryptionError;

})();