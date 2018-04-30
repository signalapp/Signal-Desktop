/* eslint-env browser */

/* eslint-disable camelcase */

module.exports = {
  encryptSymmetric,
  decryptSymmetric,
  constantTimeEqual,
};

const IV_LENGTH = 16;
const MAC_LENGTH = 16;
const NONCE_LENGTH = 16;

async function encryptSymmetric(key, plaintext) {
  const iv = _getZeros(IV_LENGTH);
  const nonce = _getRandomBytes(NONCE_LENGTH);

  const cipherKey = await _hmac_SHA256(key, nonce);
  const macKey = await _hmac_SHA256(key, cipherKey);

  const cipherText = await _encrypt_aes256_CBC_PKCSPadding(
    cipherKey,
    iv,
    plaintext
  );
  const mac = _getFirstBytes(
    await _hmac_SHA256(macKey, cipherText),
    MAC_LENGTH
  );

  return _concatData([nonce, cipherText, mac]);
}

async function decryptSymmetric(key, data) {
  const iv = _getZeros(IV_LENGTH);

  const nonce = _getFirstBytes(data, NONCE_LENGTH);
  const cipherText = _getBytes(
    data,
    NONCE_LENGTH,
    data.byteLength - NONCE_LENGTH - MAC_LENGTH
  );
  const theirMac = _getBytes(data, data.byteLength - MAC_LENGTH, MAC_LENGTH);

  const cipherKey = await _hmac_SHA256(key, nonce);
  const macKey = await _hmac_SHA256(key, cipherKey);

  const ourMac = _getFirstBytes(
    await _hmac_SHA256(macKey, cipherText),
    MAC_LENGTH
  );
  if (!constantTimeEqual(theirMac, ourMac)) {
    throw new Error(
      'decryptSymmetric: Failed to decrypt; MAC verification failed'
    );
  }

  return _decrypt_aes256_CBC_PKCSPadding(cipherKey, iv, cipherText);
}

function constantTimeEqual(left, right) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let result = 0;
  const ta1 = new Uint8Array(left);
  const ta2 = new Uint8Array(right);
  for (let i = 0, max = left.byteLength; i < max; i += 1) {
    // eslint-disable-next-line no-bitwise
    result |= ta1[i] ^ ta2[i];
  }
  return result === 0;
}

async function _hmac_SHA256(key, data) {
  const extractable = false;
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    extractable,
    ['sign']
  );

  return window.crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    cryptoKey,
    data
  );
}

async function _encrypt_aes256_CBC_PKCSPadding(key, iv, data) {
  const extractable = false;
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    extractable,
    ['encrypt']
  );

  return window.crypto.subtle.encrypt({ name: 'AES-CBC', iv }, cryptoKey, data);
}

async function _decrypt_aes256_CBC_PKCSPadding(key, iv, data) {
  const extractable = false;
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    extractable,
    ['decrypt']
  );

  return window.crypto.subtle.decrypt({ name: 'AES-CBC', iv }, cryptoKey, data);
}

function _getRandomBytes(n) {
  const bytes = new Uint8Array(n);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

function _getZeros(n) {
  const result = new Uint8Array(n);

  const value = 0;
  const startIndex = 0;
  const endExclusive = n;
  result.fill(value, startIndex, endExclusive);

  return result;
}

function _getFirstBytes(data, n) {
  const source = new Uint8Array(data);
  return source.subarray(0, n);
}

function _getBytes(data, start, n) {
  const source = new Uint8Array(data);
  return source.subarray(start, start + n);
}

function _concatData(elements) {
  const length = elements.reduce(
    (total, element) => total + element.byteLength,
    0
  );

  const result = new Uint8Array(length);
  let position = 0;

  for (let i = 0, max = elements.length; i < max; i += 1) {
    const element = new Uint8Array(elements[i]);
    result.set(element, position);
    position += element.byteLength;
  }
  if (position !== result.length) {
    throw new Error('problem concatenating!');
  }

  return result;
}
