/* global
  window,
  libsignal,
  textsecure,
  StringView,
  Multibase,
  TextEncoder,
  TextDecoder,
  crypto,
  dcodeIO,
  libloki
*/

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  const IV_LENGTH = 16;
  const NONCE_LENGTH = 12;

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

  async function deriveSymmetricKey(pubkey, seckey) {
    const ephemeralSecret = await libsignal.Curve.async.calculateAgreement(
      pubkey,
      seckey
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

  async function encryptForPubkey(pubkeyX25519, payloadBytes) {
    const ephemeral = await libloki.crypto.generateEphemeralKeyPair();

    const snPubkey = StringView.hexToArrayBuffer(pubkeyX25519);

    const symmetricKey = await deriveSymmetricKey(snPubkey, ephemeral.privKey);

    const ciphertext = await EncryptGCM(symmetricKey, payloadBytes);

    return { ciphertext, symmetricKey, ephemeralKey: ephemeral.pubKey };
  }

  async function EncryptGCM(symmetricKey, plaintext) {
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH));

    const key = await crypto.subtle.importKey(
      'raw',
      symmetricKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, tagLength: 128 },
      key,
      plaintext
    );

    const ivAndCiphertext = new Uint8Array(
      NONCE_LENGTH + ciphertext.byteLength
    );

    ivAndCiphertext.set(nonce);
    ivAndCiphertext.set(new Uint8Array(ciphertext), nonce.byteLength);

    return ivAndCiphertext;
  }

  async function DecryptGCM(symmetricKey, ivAndCiphertext) {
    const nonce = ivAndCiphertext.slice(0, NONCE_LENGTH);
    const ciphertext = ivAndCiphertext.slice(NONCE_LENGTH);

    const key = await crypto.subtle.importKey(
      'raw',
      symmetricKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    return crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      key,
      ciphertext
    );
  }

  async function DHDecrypt(symmetricKey, ivAndCiphertext) {
    const iv = ivAndCiphertext.slice(0, IV_LENGTH);
    const ciphertext = ivAndCiphertext.slice(IV_LENGTH);
    return libsignal.crypto.decrypt(symmetricKey, ciphertext, iv);
  }

  const base32zIndex = Multibase.names.indexOf('base32z');
  const base32zCode = Multibase.codes[base32zIndex];

  function decodeSnodeAddressToPubKey(snodeAddress) {
    const snodeAddressClean = snodeAddress
      .replace('.snode', '')
      .replace('https://', '')
      .replace('http://', '');
    return Multibase.decode(`${base32zCode}${snodeAddressClean}`);
  }

  async function generateEphemeralKeyPair() {
    const keys = await libsignal.Curve.async.generateKeyPair();
    // Signal protocol prepends with "0x05"
    keys.pubKey = keys.pubKey.slice(1);
    return keys;
  }

  async function decryptToken({ cipherText64, serverPubKey64 }) {
    const ivAndCiphertext = new Uint8Array(
      dcodeIO.ByteBuffer.fromBase64(cipherText64).toArrayBuffer()
    );

    const serverPubKey = new Uint8Array(
      dcodeIO.ByteBuffer.fromBase64(serverPubKey64).toArrayBuffer()
    );
    const keyPair = await textsecure.storage.protocol.getIdentityKeyPair();
    if (!keyPair) {
      throw new Error('Failed to get keypair for token decryption');
    }
    const { privKey } = keyPair;
    const symmetricKey = await libsignal.Curve.async.calculateAgreement(
      serverPubKey,
      privKey
    );

    const token = await DHDecrypt(symmetricKey, ivAndCiphertext);

    const tokenString = dcodeIO.ByteBuffer.wrap(token).toString('utf8');
    return tokenString;
  }

  const sha512 = data => crypto.subtle.digest('SHA-512', data);

  const PairingType = Object.freeze({
    REQUEST: 1,
    GRANT: 2,
  });

  window.libloki.crypto = {
    DHEncrypt,
    EncryptGCM, // AES-GCM
    DHDecrypt,
    DecryptGCM, // AES-GCM
    decryptToken,
    PairingType,
    generateEphemeralKeyPair,
    encryptForPubkey,
    _decodeSnodeAddressToPubKey: decodeSnodeAddressToPubKey,
    sha512,
  };
})();
