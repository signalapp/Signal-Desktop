// Yep, we're doing some bitwise stuff in an encryption-related file
// tslint:disable no-bitwise

// We want some extra variables to make the decrption algorithm easier to understand
// tslint:disable no-unnecessary-local-variable

// Seems that tslint doesn't understand that crypto.subtle.importKey does return a Promise
// tslint:disable await-promise

export function typedArrayToArrayBuffer(typedArray: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = typedArray;

  // tslint:disable-next-line no-unnecessary-type-assertion
  return buffer.slice(byteOffset, byteLength + byteOffset) as ArrayBuffer;
}

export function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
  return window.dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('base64');
}

export function arrayBufferToHex(arrayBuffer: ArrayBuffer) {
  return window.dcodeIO.ByteBuffer.wrap(arrayBuffer).toString('hex');
}

export function base64ToArrayBuffer(base64string: string) {
  return window.dcodeIO.ByteBuffer.wrap(base64string, 'base64').toArrayBuffer();
}

export function hexToArrayBuffer(hexString: string) {
  return window.dcodeIO.ByteBuffer.wrap(hexString, 'hex').toArrayBuffer();
}

export function fromEncodedBinaryToArrayBuffer(key: string) {
  return window.dcodeIO.ByteBuffer.wrap(key, 'binary').toArrayBuffer();
}

export function bytesFromString(string: string) {
  return window.dcodeIO.ByteBuffer.wrap(string, 'utf8').toArrayBuffer();
}
export function stringFromBytes(buffer: ArrayBuffer) {
  return window.dcodeIO.ByteBuffer.wrap(buffer).toString('utf8');
}
export function hexFromBytes(buffer: ArrayBuffer) {
  return window.dcodeIO.ByteBuffer.wrap(buffer).toString('hex');
}
export function bytesFromHexString(string: string) {
  return window.dcodeIO.ByteBuffer.wrap(string, 'hex').toArrayBuffer();
}

export async function deriveStickerPackKey(packKey: ArrayBuffer) {
  const salt = getZeroes(32);
  const info = bytesFromString('Sticker Pack');

  const [part1, part2] = await window.libsignal.HKDF.deriveSecrets(
    packKey,
    salt,
    info
  );

  return concatenateBytes(part1, part2);
}

// High-level Operations

export async function encryptDeviceName(
  deviceName: string,
  identityPublic: ArrayBuffer
) {
  const plaintext = bytesFromString(deviceName);
  const ephemeralKeyPair = await window.libsignal.KeyHelper.generateIdentityKeyPair();
  const masterSecret = await window.libsignal.Curve.async.calculateAgreement(
    identityPublic,
    ephemeralKeyPair.privKey
  );

  const key1 = await hmacSha256(masterSecret, bytesFromString('auth'));
  const syntheticIv = getFirstBytes(await hmacSha256(key1, plaintext), 16);

  const key2 = await hmacSha256(masterSecret, bytesFromString('cipher'));
  const cipherKey = await hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const ciphertext = await encryptAesCtr(cipherKey, plaintext, counter);

  return {
    ephemeralPublic: ephemeralKeyPair.pubKey,
    syntheticIv,
    ciphertext,
  };
}

export async function decryptDeviceName(
  {
    ephemeralPublic,
    syntheticIv,
    ciphertext,
  }: {
    ephemeralPublic: ArrayBuffer;
    syntheticIv: ArrayBuffer;
    ciphertext: ArrayBuffer;
  },
  identityPrivate: ArrayBuffer
) {
  const masterSecret = await window.libsignal.Curve.async.calculateAgreement(
    ephemeralPublic,
    identityPrivate
  );

  const key2 = await hmacSha256(masterSecret, bytesFromString('cipher'));
  const cipherKey = await hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const plaintext = await decryptAesCtr(cipherKey, ciphertext, counter);

  const key1 = await hmacSha256(masterSecret, bytesFromString('auth'));
  const ourSyntheticIv = getFirstBytes(await hmacSha256(key1, plaintext), 16);

  if (!constantTimeEqual(ourSyntheticIv, syntheticIv)) {
    throw new Error('decryptDeviceName: synthetic IV did not match');
  }

  return stringFromBytes(plaintext);
}

// Path structure: 'fa/facdf99c22945b1c9393345599a276f4b36ad7ccdc8c2467f5441b742c2d11fa'
export function getAttachmentLabel(path: string) {
  const filename = path.slice(3);

  return base64ToArrayBuffer(filename);
}

const PUB_KEY_LENGTH = 32;
export async function encryptAttachment(
  staticPublicKey: ArrayBuffer,
  path: string,
  plaintext: ArrayBuffer
) {
  const uniqueId = getAttachmentLabel(path);

  return encryptFile(staticPublicKey, uniqueId, plaintext);
}

export async function decryptAttachment(
  staticPrivateKey: ArrayBuffer,
  path: string,
  data: ArrayBuffer
) {
  const uniqueId = getAttachmentLabel(path);

  return decryptFile(staticPrivateKey, uniqueId, data);
}

export async function encryptFile(
  staticPublicKey: ArrayBuffer,
  uniqueId: ArrayBuffer,
  plaintext: ArrayBuffer
) {
  const ephemeralKeyPair = await window.libsignal.KeyHelper.generateIdentityKeyPair();
  const agreement = await window.libsignal.Curve.async.calculateAgreement(
    staticPublicKey,
    ephemeralKeyPair.privKey
  );
  const key = await hmacSha256(agreement, uniqueId);

  const prefix = ephemeralKeyPair.pubKey.slice(1);

  return concatenateBytes(prefix, await encryptSymmetric(key, plaintext));
}

export async function decryptFile(
  staticPrivateKey: ArrayBuffer,
  uniqueId: ArrayBuffer,
  data: ArrayBuffer
) {
  const ephemeralPublicKey = getFirstBytes(data, PUB_KEY_LENGTH);
  const ciphertext = _getBytes(data, PUB_KEY_LENGTH, data.byteLength);
  const agreement = await window.libsignal.Curve.async.calculateAgreement(
    ephemeralPublicKey,
    staticPrivateKey
  );

  const key = await hmacSha256(agreement, uniqueId);

  return decryptSymmetric(key, ciphertext);
}

export async function deriveStorageManifestKey(
  storageServiceKey: ArrayBuffer,
  version: number
) {
  return hmacSha256(storageServiceKey, bytesFromString(`Manifest_${version}`));
}

export async function deriveStorageItemKey(
  storageServiceKey: ArrayBuffer,
  itemID: string
) {
  return hmacSha256(storageServiceKey, bytesFromString(`Item_${itemID}`));
}

export async function deriveAccessKey(profileKey: ArrayBuffer) {
  const iv = getZeroes(12);
  const plaintext = getZeroes(16);
  const accessKey = await _encrypt_aes_gcm(profileKey, iv, plaintext);

  return getFirstBytes(accessKey, 16);
}

export async function getAccessKeyVerifier(accessKey: ArrayBuffer) {
  const plaintext = getZeroes(32);

  return hmacSha256(accessKey, plaintext);
}

export async function verifyAccessKey(
  accessKey: ArrayBuffer,
  theirVerifier: ArrayBuffer
) {
  const ourVerifier = await getAccessKeyVerifier(accessKey);

  if (constantTimeEqual(ourVerifier, theirVerifier)) {
    return true;
  }

  return false;
}

const IV_LENGTH = 16;
const MAC_LENGTH = 16;
const NONCE_LENGTH = 16;

export async function encryptSymmetric(
  key: ArrayBuffer,
  plaintext: ArrayBuffer
) {
  const iv = getZeroes(IV_LENGTH);
  const nonce = getRandomBytes(NONCE_LENGTH);

  const cipherKey = await hmacSha256(key, nonce);
  const macKey = await hmacSha256(key, cipherKey);

  const cipherText = await _encrypt_aes256_CBC_PKCSPadding(
    cipherKey,
    iv,
    plaintext
  );
  const mac = getFirstBytes(await hmacSha256(macKey, cipherText), MAC_LENGTH);

  return concatenateBytes(nonce, cipherText, mac);
}

export async function decryptSymmetric(key: ArrayBuffer, data: ArrayBuffer) {
  const iv = getZeroes(IV_LENGTH);

  const nonce = getFirstBytes(data, NONCE_LENGTH);
  const cipherText = _getBytes(
    data,
    NONCE_LENGTH,
    data.byteLength - NONCE_LENGTH - MAC_LENGTH
  );
  const theirMac = _getBytes(data, data.byteLength - MAC_LENGTH, MAC_LENGTH);

  const cipherKey = await hmacSha256(key, nonce);
  const macKey = await hmacSha256(key, cipherKey);

  const ourMac = getFirstBytes(
    await hmacSha256(macKey, cipherText),
    MAC_LENGTH
  );
  if (!constantTimeEqual(theirMac, ourMac)) {
    throw new Error(
      'decryptSymmetric: Failed to decrypt; MAC verification failed'
    );
  }

  return _decrypt_aes256_CBC_PKCSPadding(cipherKey, iv, cipherText);
}

export function constantTimeEqual(left: ArrayBuffer, right: ArrayBuffer) {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  let result = 0;
  const ta1 = new Uint8Array(left);
  const ta2 = new Uint8Array(right);
  const max = left.byteLength;
  for (let i = 0; i < max; i += 1) {
    // eslint-disable-next-line no-bitwise
    result |= ta1[i] ^ ta2[i];
  }

  return result === 0;
}

// Encryption

export async function hmacSha256(key: ArrayBuffer, plaintext: ArrayBuffer) {
  const algorithm = {
    name: 'HMAC',
    hash: 'SHA-256',
  };
  const extractable = false;

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    algorithm as any,
    extractable,
    ['sign']
  );

  return window.crypto.subtle.sign(algorithm, cryptoKey, plaintext);
}

export async function _encrypt_aes256_CBC_PKCSPadding(
  key: ArrayBuffer,
  iv: ArrayBuffer,
  plaintext: ArrayBuffer
) {
  const algorithm = {
    name: 'AES-CBC',
    iv,
  };
  const extractable = false;

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    algorithm as any,
    extractable,
    ['encrypt']
  );

  return window.crypto.subtle.encrypt(algorithm, cryptoKey, plaintext);
}

export async function _decrypt_aes256_CBC_PKCSPadding(
  key: ArrayBuffer,
  iv: ArrayBuffer,
  plaintext: ArrayBuffer
) {
  const algorithm = {
    name: 'AES-CBC',
    iv,
  };
  const extractable = false;

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    key,
    algorithm as any,
    extractable,
    ['decrypt']
  );

  return window.crypto.subtle.decrypt(algorithm, cryptoKey, plaintext);
}

export async function encryptAesCtr(
  key: ArrayBuffer,
  plaintext: ArrayBuffer,
  counter: ArrayBuffer
) {
  const extractable = false;
  const algorithm = {
    name: 'AES-CTR',
    counter: new Uint8Array(counter),
    length: 128,
  };

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    algorithm as any,
    extractable,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    algorithm,
    cryptoKey,
    plaintext
  );

  return ciphertext;
}

export async function decryptAesCtr(
  key: ArrayBuffer,
  ciphertext: ArrayBuffer,
  counter: ArrayBuffer
) {
  const extractable = false;
  const algorithm = {
    name: 'AES-CTR',
    counter: new Uint8Array(counter),
    length: 128,
  };

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    algorithm as any,
    extractable,
    ['decrypt']
  );
  const plaintext = await crypto.subtle.decrypt(
    algorithm,
    cryptoKey,
    ciphertext
  );

  return plaintext;
}

export async function _encrypt_aes_gcm(
  key: ArrayBuffer,
  iv: ArrayBuffer,
  plaintext: ArrayBuffer
) {
  const algorithm = {
    name: 'AES-GCM',
    iv,
  };
  const extractable = false;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    algorithm as any,
    extractable,
    ['encrypt']
  );

  return crypto.subtle.encrypt(algorithm, cryptoKey, plaintext);
}

// Utility

export function getRandomBytes(n: number) {
  const bytes = new Uint8Array(n);
  window.crypto.getRandomValues(bytes);

  return typedArrayToArrayBuffer(bytes);
}

export function getRandomValue(low: number, high: number): number {
  const diff = high - low;
  const bytes = new Uint32Array(1);
  window.crypto.getRandomValues(bytes);

  // Because high and low are inclusive
  const mod = diff + 1;

  return (bytes[0] % mod) + low;
}

export function getZeroes(n: number) {
  const result = new Uint8Array(n);

  const value = 0;
  const startIndex = 0;
  const endExclusive = n;
  result.fill(value, startIndex, endExclusive);

  return typedArrayToArrayBuffer(result);
}

export function highBitsToInt(byte: number): number {
  return (byte & 0xff) >> 4;
}

export function intsToByteHighAndLow(
  highValue: number,
  lowValue: number
): number {
  return ((highValue << 4) | lowValue) & 0xff;
}

export function trimBytes(buffer: ArrayBuffer, length: number) {
  return getFirstBytes(buffer, length);
}

export function getViewOfArrayBuffer(
  buffer: ArrayBuffer,
  start: number,
  finish: number
) {
  const source = new Uint8Array(buffer);
  const result = source.slice(start, finish);

  return result.buffer;
}

export function concatenateBytes(...elements: Array<ArrayBuffer | Uint8Array>) {
  const length = elements.reduce(
    (total, element) => total + element.byteLength,
    0
  );

  const result = new Uint8Array(length);
  let position = 0;

  const max = elements.length;
  for (let i = 0; i < max; i += 1) {
    const element = new Uint8Array(elements[i]);
    result.set(element, position);
    position += element.byteLength;
  }
  if (position !== result.length) {
    throw new Error('problem concatenating!');
  }

  return typedArrayToArrayBuffer(result);
}

export function splitBytes(
  buffer: ArrayBuffer,
  ...lengths: Array<number>
): Array<ArrayBuffer> {
  const total = lengths.reduce((acc, length) => acc + length, 0);

  if (total !== buffer.byteLength) {
    throw new Error(
      `Requested lengths total ${total} does not match source total ${buffer.byteLength}`
    );
  }

  const source = new Uint8Array(buffer);
  const results = [];
  let position = 0;

  const max = lengths.length;
  for (let i = 0; i < max; i += 1) {
    const length = lengths[i];
    const result = new Uint8Array(length);
    const section = source.slice(position, position + length);
    result.set(section);
    position += result.byteLength;

    results.push(typedArrayToArrayBuffer(result));
  }

  return results;
}

export function getFirstBytes(data: ArrayBuffer, n: number) {
  const source = new Uint8Array(data);

  return typedArrayToArrayBuffer(source.subarray(0, n));
}

// Internal-only

export function _getBytes(
  data: ArrayBuffer | Uint8Array,
  start: number,
  n: number
) {
  const source = new Uint8Array(data);

  return typedArrayToArrayBuffer(source.subarray(start, start + n));
}
