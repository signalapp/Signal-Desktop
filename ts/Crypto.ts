// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Buffer } from 'buffer';
import Long from 'long';
import { Aci, HKDF } from '@signalapp/libsignal-client';
import { AccountEntropyPool } from '@signalapp/libsignal-client/dist/AccountKeys';

import * as Bytes from './Bytes';
import { Crypto } from './context/Crypto';
import { calculateAgreement, generateKeyPair } from './Curve';
import { HashType, CipherType } from './types/Crypto';
import { ProfileDecryptError } from './types/errors';
import { getBytesSubarray } from './util/uuidToBytes';
import { logPadSize } from './util/logPadding';
import { Environment, getEnvironment } from './environment';
import { toWebSafeBase64 } from './util/webSafeBase64';

import type { AciString } from './types/ServiceId';

export { HashType, CipherType };

const PROFILE_IV_LENGTH = 12; // bytes
const PROFILE_KEY_LENGTH = 32; // bytes

// bytes
export const PaddedLengths = {
  Name: [53, 257],
  About: [128, 254, 512],
  AboutEmoji: [32],
  PaymentAddress: [554],
};

export type EncryptedAttachment = {
  ciphertext: Uint8Array;
  digest: Uint8Array;
  plaintextHash: string;
};

export function generateRegistrationId(): number {
  return randomInt(1, 16383);
}

export function deriveStickerPackKey(packKey: Uint8Array): Uint8Array {
  const salt = getZeroes(32);
  const info = Bytes.fromString('Sticker Pack');

  const [part1, part2] = deriveSecrets(packKey, salt, info);

  return Bytes.concatenate([part1, part2]);
}

export function deriveSecrets(
  input: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array
): [Uint8Array, Uint8Array, Uint8Array] {
  const hkdf = HKDF.new(3);
  const output = hkdf.deriveSecrets(
    3 * 32,
    Buffer.from(input),
    Buffer.from(info),
    Buffer.from(salt)
  );
  return [output.slice(0, 32), output.slice(32, 64), output.slice(64, 96)];
}

export function deriveMasterKeyFromGroupV1(groupV1Id: Uint8Array): Uint8Array {
  const salt = getZeroes(32);
  const info = Bytes.fromString('GV2 Migration');

  const [part1] = deriveSecrets(groupV1Id, salt, info);

  return part1;
}

export function hashProfileKey(
  profileKey: string | undefined,
  aci: AciString
): string {
  if (!profileKey) {
    return 'none';
  }

  const profileKeyBytes = Bytes.fromBase64(profileKey);
  const aciBytes = Aci.parseFromServiceIdString(aci).getRawUuidBytes();
  const hashBytes = hmacSha256(
    profileKeyBytes,
    Bytes.concatenate([Bytes.fromString('profileKeyHash'), aciBytes])
  );

  const webSafe = toWebSafeBase64(Bytes.toBase64(hashBytes));

  return webSafe.slice(-3);
}

export function computeHash(data: Uint8Array): string {
  return Bytes.toBase64(hash(HashType.size512, data));
}

// High-level Operations

export type EncryptedDeviceName = {
  ephemeralPublic: Uint8Array;
  syntheticIv: Uint8Array;
  ciphertext: Uint8Array;
};

export function encryptDeviceName(
  deviceName: string,
  identityPublic: Uint8Array
): EncryptedDeviceName {
  const plaintext = Bytes.fromString(deviceName);
  const ephemeralKeyPair = generateKeyPair();
  const masterSecret = calculateAgreement(
    identityPublic,
    ephemeralKeyPair.privKey
  );

  const key1 = hmacSha256(masterSecret, Bytes.fromString('auth'));
  const syntheticIv = getFirstBytes(hmacSha256(key1, plaintext), 16);

  const key2 = hmacSha256(masterSecret, Bytes.fromString('cipher'));
  const cipherKey = hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const ciphertext = encryptAesCtr(cipherKey, plaintext, counter);

  return {
    ephemeralPublic: ephemeralKeyPair.pubKey,
    syntheticIv,
    ciphertext,
  };
}

export function decryptDeviceName(
  { ephemeralPublic, syntheticIv, ciphertext }: EncryptedDeviceName,
  identityPrivate: Uint8Array
): string {
  const masterSecret = calculateAgreement(ephemeralPublic, identityPrivate);

  const key2 = hmacSha256(masterSecret, Bytes.fromString('cipher'));
  const cipherKey = hmacSha256(key2, syntheticIv);

  const counter = getZeroes(16);
  const plaintext = decryptAesCtr(cipherKey, ciphertext, counter);

  const key1 = hmacSha256(masterSecret, Bytes.fromString('auth'));
  const ourSyntheticIv = getFirstBytes(hmacSha256(key1, plaintext), 16);

  if (!constantTimeEqual(ourSyntheticIv, syntheticIv)) {
    throw new Error('decryptDeviceName: synthetic IV did not match');
  }

  return Bytes.toString(plaintext);
}

export function deriveMasterKey(accountEntropyPool: string): Uint8Array {
  return AccountEntropyPool.deriveSvrKey(accountEntropyPool);
}

export function deriveStorageServiceKey(masterKey: Uint8Array): Uint8Array {
  return hmacSha256(masterKey, Bytes.fromString('Storage Service Encryption'));
}

export function deriveStorageManifestKey(
  storageServiceKey: Uint8Array,
  version: Long = Long.fromNumber(0)
): Uint8Array {
  return hmacSha256(storageServiceKey, Bytes.fromString(`Manifest_${version}`));
}

const STORAGE_SERVICE_ITEM_KEY_INFO_PREFIX =
  '20240801_SIGNAL_STORAGE_SERVICE_ITEM_';
const STORAGE_SERVICE_ITEM_KEY_LEN = 32;

export type DeriveStorageItemKeyOptionsType = Readonly<{
  storageServiceKey: Uint8Array;
  recordIkm: Uint8Array | undefined;
  key: Uint8Array;
}>;

export function deriveStorageItemKey({
  storageServiceKey,
  recordIkm,
  key,
}: DeriveStorageItemKeyOptionsType): Uint8Array {
  if (recordIkm == null) {
    const itemID = Bytes.toBase64(key);
    return hmacSha256(storageServiceKey, Bytes.fromString(`Item_${itemID}`));
  }

  const hkdf = HKDF.new(3);
  return hkdf.deriveSecrets(
    STORAGE_SERVICE_ITEM_KEY_LEN,
    Buffer.from(recordIkm),
    Buffer.concat([
      Buffer.from(STORAGE_SERVICE_ITEM_KEY_INFO_PREFIX),
      Buffer.from(key),
    ]),
    Buffer.alloc(0)
  );
}

export function deriveAccessKey(profileKey: Uint8Array): Uint8Array {
  const iv = getZeroes(12);
  const plaintext = getZeroes(16);
  const accessKey = encryptAesGcm(profileKey, iv, plaintext);

  return getFirstBytes(accessKey, 16);
}

export function getAccessKeyVerifier(accessKey: Uint8Array): Uint8Array {
  const plaintext = getZeroes(32);

  return hmacSha256(accessKey, plaintext);
}

export function verifyAccessKey(
  accessKey: Uint8Array,
  theirVerifier: Uint8Array
): boolean {
  const ourVerifier = getAccessKeyVerifier(accessKey);

  if (constantTimeEqual(ourVerifier, theirVerifier)) {
    return true;
  }

  return false;
}

const IV_LENGTH = 16;
const NONCE_LENGTH = 16;
const SYMMETRIC_MAC_LENGTH = 16;

export function encryptSymmetric(
  key: Uint8Array,
  plaintext: Uint8Array
): Uint8Array {
  const iv = getZeroes(IV_LENGTH);
  const nonce = getRandomBytes(NONCE_LENGTH);

  const cipherKey = hmacSha256(key, nonce);
  const macKey = hmacSha256(key, cipherKey);

  const ciphertext = encryptAes256CbcPkcsPadding(cipherKey, plaintext, iv);
  const mac = getFirstBytes(
    hmacSha256(macKey, ciphertext),
    SYMMETRIC_MAC_LENGTH
  );

  return Bytes.concatenate([nonce, ciphertext, mac]);
}

export function decryptSymmetric(
  key: Uint8Array,
  data: Uint8Array
): Uint8Array {
  const iv = getZeroes(IV_LENGTH);

  const nonce = getFirstBytes(data, NONCE_LENGTH);
  const ciphertext = getBytesSubarray(
    data,
    NONCE_LENGTH,
    data.byteLength - NONCE_LENGTH - SYMMETRIC_MAC_LENGTH
  );
  const theirMac = getBytesSubarray(
    data,
    data.byteLength - SYMMETRIC_MAC_LENGTH,
    SYMMETRIC_MAC_LENGTH
  );

  const cipherKey = hmacSha256(key, nonce);
  const macKey = hmacSha256(key, cipherKey);

  const ourMac = getFirstBytes(
    hmacSha256(macKey, ciphertext),
    SYMMETRIC_MAC_LENGTH
  );
  if (!constantTimeEqual(theirMac, ourMac)) {
    throw new Error(
      'decryptSymmetric: Failed to decrypt; MAC verification failed'
    );
  }

  return decryptAes256CbcPkcsPadding(cipherKey, ciphertext, iv);
}

// Encryption

export function hmacSha256(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
  return sign(key, plaintext);
}

// We use part of the constantTimeEqual algorithm from below here, but we allow ourMac
//   to be longer than the passed-in length. This allows easy comparisons against
//   arbitrary MAC lengths.
export function verifyHmacSha256(
  plaintext: Uint8Array,
  key: Uint8Array,
  theirMac: Uint8Array,
  length: number
): void {
  const ourMac = hmacSha256(key, plaintext);

  if (theirMac.byteLength !== length || ourMac.byteLength < length) {
    throw new Error('Bad MAC length');
  }
  let result = 0;

  for (let i = 0; i < theirMac.byteLength; i += 1) {
    // eslint-disable-next-line no-bitwise
    result |= ourMac[i] ^ theirMac[i];
  }
  if (result !== 0) {
    throw new Error('Bad MAC');
  }
}

export function encryptAes256CbcPkcsPadding(
  key: Uint8Array,
  plaintext: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  return encrypt(CipherType.AES256CBC, {
    key,
    plaintext,
    iv,
  });
}

export function decryptAes256CbcPkcsPadding(
  key: Uint8Array,
  ciphertext: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  return decrypt(CipherType.AES256CBC, {
    key,
    ciphertext,
    iv,
  });
}

export function encryptAesCtr(
  key: Uint8Array,
  plaintext: Uint8Array,
  counter: Uint8Array
): Uint8Array {
  return encrypt(CipherType.AES256CTR, {
    key,
    plaintext,
    iv: counter,
  });
}

export function decryptAesCtr(
  key: Uint8Array,
  ciphertext: Uint8Array,
  counter: Uint8Array
): Uint8Array {
  return decrypt(CipherType.AES256CTR, {
    key,
    ciphertext,
    iv: counter,
  });
}

export function encryptAesGcm(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array
): Uint8Array {
  return encrypt(CipherType.AES256GCM, {
    key,
    plaintext,
    iv,
    aad,
  });
}

export function decryptAesGcm(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array
): Uint8Array {
  return decrypt(CipherType.AES256GCM, {
    key,
    ciphertext,
    iv,
  });
}

// Hashing

export function sha256(data: Uint8Array): Uint8Array {
  return hash(HashType.size256, data);
}

// Utility

export function getZeroes(n: number): Uint8Array {
  return new Uint8Array(n);
}

export function highBitsToInt(byte: number): number {
  // eslint-disable-next-line no-bitwise
  return (byte & 0xff) >> 4;
}

export function intsToByteHighAndLow(
  highValue: number,
  lowValue: number
): number {
  // eslint-disable-next-line no-bitwise
  return ((highValue << 4) | lowValue) & 0xff;
}

export function getFirstBytes(data: Uint8Array, n: number): Uint8Array {
  return data.subarray(0, n);
}

export function trimForDisplay(padded: Uint8Array): Uint8Array {
  let paddingEnd = 0;
  for (paddingEnd; paddingEnd < padded.length; paddingEnd += 1) {
    if (padded[paddingEnd] === 0x00) {
      break;
    }
  }
  return padded.slice(0, paddingEnd);
}

function verifyDigest(data: Uint8Array, theirDigest: Uint8Array): void {
  const ourDigest = sha256(data);
  let result = 0;
  for (let i = 0; i < theirDigest.byteLength; i += 1) {
    // eslint-disable-next-line no-bitwise
    result |= ourDigest[i] ^ theirDigest[i];
  }
  if (result !== 0) {
    throw new Error('Bad digest');
  }
}

export function decryptAttachmentV1(
  encryptedBin: Uint8Array,
  keys: Uint8Array,
  theirDigest?: Uint8Array
): Uint8Array {
  if (keys.byteLength !== 64) {
    throw new Error('Got invalid length attachment keys');
  }
  if (encryptedBin.byteLength < 16 + 32) {
    throw new Error('Got invalid length attachment');
  }

  const aesKey = keys.slice(0, 32);
  const macKey = keys.slice(32, 64);

  const iv = encryptedBin.slice(0, 16);
  const ciphertext = encryptedBin.slice(16, encryptedBin.byteLength - 32);
  const ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
  const mac = encryptedBin.slice(
    encryptedBin.byteLength - 32,
    encryptedBin.byteLength
  );

  verifyHmacSha256(ivAndCiphertext, macKey, mac, 32);

  if (theirDigest) {
    verifyDigest(encryptedBin, theirDigest);
  }

  return decryptAes256CbcPkcsPadding(aesKey, ciphertext, iv);
}

export function encryptAttachment({
  plaintext,
  keys,
  dangerousTestOnlyIv,
}: {
  plaintext: Readonly<Uint8Array>;
  keys: Readonly<Uint8Array>;
  dangerousTestOnlyIv?: Readonly<Uint8Array>;
}): Omit<EncryptedAttachment, 'plaintextHash'> {
  const logId = 'encryptAttachment';
  if (!(plaintext instanceof Uint8Array)) {
    throw new TypeError(
      `${logId}: \`plaintext\` must be an \`Uint8Array\`; got: ${typeof plaintext}`
    );
  }

  if (keys.byteLength !== 64) {
    throw new Error(`${logId}: invalid length attachment keys`);
  }

  if (dangerousTestOnlyIv && getEnvironment() !== Environment.Test) {
    throw new Error(`${logId}: Used dangerousTestOnlyIv outside tests!`);
  }

  const iv = dangerousTestOnlyIv || getRandomBytes(16);
  const aesKey = keys.slice(0, 32);
  const macKey = keys.slice(32, 64);

  const ciphertext = encryptAes256CbcPkcsPadding(aesKey, plaintext, iv);

  const ivAndCiphertext = Bytes.concatenate([iv, ciphertext]);

  const mac = hmacSha256(macKey, ivAndCiphertext);

  const encryptedBin = Bytes.concatenate([ivAndCiphertext, mac]);
  const digest = sha256(encryptedBin);

  return {
    ciphertext: encryptedBin,
    digest,
  };
}

export function padAndEncryptAttachment({
  plaintext,
  keys,
  dangerousTestOnlyIv,
}: {
  plaintext: Readonly<Uint8Array>;
  keys: Readonly<Uint8Array>;
  dangerousTestOnlyIv?: Readonly<Uint8Array>;
}): EncryptedAttachment {
  const size = plaintext.byteLength;
  const paddedSize = logPadSize(size);
  const padding = getZeroes(paddedSize - size);

  return {
    ...encryptAttachment({
      plaintext: Bytes.concatenate([plaintext, padding]),
      keys,
      dangerousTestOnlyIv,
    }),
    // We generate the plaintext hash here for forwards-compatibility with streaming
    // attachment encryption, which may be the only place that the whole attachment flows
    // through memory
    plaintextHash: Buffer.from(sha256(plaintext)).toString('hex'),
  };
}

export function encryptProfile(data: Uint8Array, key: Uint8Array): Uint8Array {
  const iv = getRandomBytes(PROFILE_IV_LENGTH);
  if (key.byteLength !== PROFILE_KEY_LENGTH) {
    throw new Error('Got invalid length profile key');
  }
  if (iv.byteLength !== PROFILE_IV_LENGTH) {
    throw new Error('Got invalid length profile iv');
  }
  const ciphertext = encryptAesGcm(key, iv, data);
  return Bytes.concatenate([iv, ciphertext]);
}

export function decryptProfile(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (data.byteLength < 12 + 16 + 1) {
    throw new Error(`Got too short input: ${data.byteLength}`);
  }
  const iv = data.slice(0, PROFILE_IV_LENGTH);
  const ciphertext = data.slice(PROFILE_IV_LENGTH, data.byteLength);
  if (key.byteLength !== PROFILE_KEY_LENGTH) {
    throw new Error('Got invalid length profile key');
  }
  if (iv.byteLength !== PROFILE_IV_LENGTH) {
    throw new Error('Got invalid length profile iv');
  }

  try {
    return decryptAesGcm(key, iv, ciphertext);
  } catch (_) {
    throw new ProfileDecryptError(
      'Failed to decrypt profile data. ' +
        'Most likely the profile key has changed.'
    );
  }
}

export function encryptProfileItemWithPadding(
  item: Uint8Array,
  profileKey: Uint8Array,
  paddedLengths: (typeof PaddedLengths)[keyof typeof PaddedLengths]
): Uint8Array {
  const paddedLength = paddedLengths.find(
    (length: number) => item.byteLength <= length
  );
  if (!paddedLength) {
    throw new Error('Oversized value');
  }
  const padded = new Uint8Array(paddedLength);
  padded.set(new Uint8Array(item));
  return encryptProfile(padded, profileKey);
}

export function decryptProfileName(
  encryptedProfileName: string,
  key: Uint8Array
): { given: Uint8Array; family: Uint8Array | null } {
  const data = Bytes.fromBase64(encryptedProfileName);
  const padded = decryptProfile(data, key);

  // Given name is the start of the string to the first null character
  let givenEnd;
  for (givenEnd = 0; givenEnd < padded.length; givenEnd += 1) {
    if (padded[givenEnd] === 0x00) {
      break;
    }
  }

  // Family name is the next chunk of non-null characters after that first null
  let familyEnd;
  for (familyEnd = givenEnd + 1; familyEnd < padded.length; familyEnd += 1) {
    if (padded[familyEnd] === 0x00) {
      break;
    }
  }
  const foundFamilyName = familyEnd > givenEnd + 1;

  return {
    given: padded.slice(0, givenEnd),
    family: foundFamilyName ? padded.slice(givenEnd + 1, familyEnd) : null,
  };
}

//
// SignalContext APIs
//

const crypto = globalThis.window?.SignalContext.crypto || new Crypto();

export function sign(key: Uint8Array, data: Uint8Array): Uint8Array {
  return crypto.sign(key, data);
}

export function hash(type: HashType, data: Uint8Array): Uint8Array {
  return crypto.hash(type, data);
}

export function encrypt(
  ...args: Parameters<typeof crypto.encrypt>
): Uint8Array {
  return crypto.encrypt(...args);
}

export function decrypt(
  ...args: Parameters<typeof crypto.decrypt>
): Uint8Array {
  return crypto.decrypt(...args);
}

/**
 * Generate an integer between `min` and `max`, inclusive.
 */
export function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

export function getRandomBytes(size: number): Uint8Array {
  return crypto.getRandomBytes(size);
}

export function constantTimeEqual(
  left: Uint8Array,
  right: Uint8Array
): boolean {
  return crypto.constantTimeEqual(left, right);
}
