/* global window, libsignal, textsecure, StringView, Multibase */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  class FallBackDecryptionError extends Error {}

  const IV_LENGTH = 16;

  async function DHEncrypt(symmetricKey, plainText) {
    const iv = libsignal.crypto.getRandomBytes(IV_LENGTH);
    const ciphertext = await libsignal.crypto.encrypt(
      symmetricKey,
      plainText,
      iv
    );
    const ivAndCiphertext = new Uint8Array(
      iv.byteLength + ciphertext.byteLength
    );
    ivAndCiphertext.set(new Uint8Array(iv));
    ivAndCiphertext.set(new Uint8Array(ciphertext), iv.byteLength);
    return ivAndCiphertext;
  }

  async function DHDecrypt(symmetricKey, ivAndCiphertext) {
    const iv = ivAndCiphertext.slice(0, IV_LENGTH);
    const cipherText = ivAndCiphertext.slice(IV_LENGTH);
    return libsignal.crypto.decrypt(symmetricKey, cipherText, iv);
  }

  class FallBackSessionCipher {
    constructor(address) {
      this.identityKeyString = address.getName();
      this.pubKey = StringView.hexToArrayBuffer(address.getName());
    }

    async encrypt(plaintext) {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(
        this.pubKey,
        myPrivateKey
      );
      const ivAndCiphertext = await DHEncrypt(symmetricKey, plaintext);
      return {
        type: textsecure.protobuf.Envelope.Type.FRIEND_REQUEST,
        body: ivAndCiphertext,
        registrationId: null,
      };
    }

    async decrypt(ivAndCiphertext) {
      const myKeyPair = await textsecure.storage.protocol.getIdentityKeyPair();
      const myPrivateKey = myKeyPair.privKey;
      const symmetricKey = libsignal.Curve.calculateAgreement(
        this.pubKey,
        myPrivateKey
      );
      try {
        return await DHDecrypt(symmetricKey, ivAndCiphertext);
      } catch (e) {
        throw new FallBackDecryptionError(
          `Could not decrypt message from ${
            this.identityKeyString
          } using FallBack encryption.`
        );
      }
    }
  }

  const base32zIndex = Multibase.names.indexOf('base32z');
  const base32zCode = Multibase.codes[base32zIndex];

  function bufferToArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; i += 1) {
      view[i] = buf[i];
    }
    return ab;
  }

  function decodeSnodeAddressToBuffer(snodeAddress) {
    const snodeAddressClean = snodeAddress
      .replace('.snode', '')
      .replace('http://', '');
    return Multibase.decode(`${base32zCode}${snodeAddressClean}`);
  }

  class LokiSnodeChannel {
    constructor() {
      this._ephemeralKeyPair = libsignal.Curve.generateKeyPair();
      // Signal protocol prepends with "0x05"
      this._ephemeralKeyPair.pubKey = this._ephemeralKeyPair.pubKey.slice(1);
      this._ephemeralPubKeyHex = StringView.arrayBufferToHex(
        this._ephemeralKeyPair.pubKey
      );
      this._cache = {};
    }

    _getSymmetricKey(snodeAddress) {
      if (snodeAddress in this._cache) {
        return this._cache[snodeAddress];
      }
      const buffer = decodeSnodeAddressToBuffer(snodeAddress);
      const snodePubKeyArrayBuffer = bufferToArrayBuffer(buffer);
      const symmetricKey = libsignal.Curve.calculateAgreement(
        snodePubKeyArrayBuffer,
        this._ephemeralKeyPair.privKey
      );
      this._cache[snodeAddress] = symmetricKey;
      return symmetricKey;
    }

    getChannelPublicKeyHex() {
      return this._ephemeralPubKeyHex;
    }

    async decrypt(snodeAddress, ivAndCipherText) {
      const symmetricKey = this._getSymmetricKey(snodeAddress);
      try {
        return await DHDecrypt(symmetricKey, ivAndCipherText);
      } catch (e) {
        return ivAndCipherText;
      }
    }

    async encrypt(snodeAddress, plainText) {
      const symmetricKey = this._getSymmetricKey(snodeAddress);
      return DHEncrypt(symmetricKey, plainText);
    }
  }

  const snodeCipher = new LokiSnodeChannel();

  window.libloki.crypto = {
    DHEncrypt,
    DHDecrypt,
    FallBackSessionCipher,
    FallBackDecryptionError,
    snodeCipher,
    // for testing
    _LokiSnodeChannel: LokiSnodeChannel,
    _decodeSnodeAddressToBuffer: decodeSnodeAddressToBuffer,
  };
})();
