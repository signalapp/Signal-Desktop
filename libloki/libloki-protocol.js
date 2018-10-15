/* global window, libsignal, textsecure */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

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
          body           : new dcodeIO.ByteBuffer.wrap(ivAndCiphertext).toString('binary'),
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
  
  window.libloki.FallBackSessionCipher = FallBackSessionCipher;
  window.libloki.FallBackDecryptionError = FallBackDecryptionError;

})();