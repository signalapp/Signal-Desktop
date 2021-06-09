/* global
  window,
  libsignal,
  StringView,
  TextEncoder,
  TextDecoder,
  crypto,
  libloki
*/

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  const NONCE_LENGTH = 12;

  async function deriveSymmetricKey(x25519PublicKey, x25519PrivateKey) {
    const ephemeralSecret = await libsignal.Curve.async.calculateAgreement(
      x25519PublicKey,
      x25519PrivateKey
    );

    const salt = window.Signal.Crypto.bytesFromString('LOKI');

    const key = await crypto.subtle.importKey(
      'raw',
      salt,
      { name: 'HMAC', hash: { name: 'SHA-256' } },
      false,
      ['sign']
    );
    const symmetricKey = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      key,
      ephemeralSecret
    );

    return symmetricKey;
  }

  // encryptForPubkey: string, payloadBytes: Uint8Array
  async function encryptForPubkey(pubkeyX25519, payloadBytes) {
    const ephemeral = await libloki.crypto.generateEphemeralKeyPair();
    const snPubkey = StringView.hexToArrayBuffer(pubkeyX25519);
    const symmetricKey = await deriveSymmetricKey(snPubkey, ephemeral.privKey);
    const ciphertext = await EncryptAESGCM(symmetricKey, payloadBytes);

    return { ciphertext, symmetricKey, ephemeralKey: ephemeral.pubKey };
  }

  async function EncryptAESGCM(symmetricKey, plaintext) {
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

    const key = await crypto.subtle.importKey('raw', symmetricKey, { name: 'AES-GCM' }, false, [
      'encrypt',
    ]);

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      key,
      plaintext
    );

    const ivAndCiphertext = new Uint8Array(NONCE_LENGTH + ciphertext.byteLength);

    ivAndCiphertext.set(nonce);
    ivAndCiphertext.set(new Uint8Array(ciphertext), nonce.byteLength);

    return ivAndCiphertext;
  }

  async function DecryptAESGCM(symmetricKey, ivAndCiphertext) {
    const nonce = ivAndCiphertext.slice(0, NONCE_LENGTH);
    const ciphertext = ivAndCiphertext.slice(NONCE_LENGTH);
    const key = await crypto.subtle.importKey('raw', symmetricKey, { name: 'AES-GCM' }, false, [
      'decrypt',
    ]);

    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext);
  }
  async function generateEphemeralKeyPair() {
    const keys = await libsignal.Curve.async.generateKeyPair();
    // Signal protocol prepends with "0x05"
    keys.pubKey = keys.pubKey.slice(1);
    return keys;
  }

  window.libloki.crypto = {
    EncryptAESGCM, // AES-GCM
    DecryptAESGCM, // AES-GCM
    deriveSymmetricKey,
    generateEphemeralKeyPair,
    encryptForPubkey,
  };
})();
