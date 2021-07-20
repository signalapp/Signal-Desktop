// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-bitwise */
/* eslint-disable more/no-then */
import {
  decryptAes256CbcPkcsPadding,
  encryptAes256CbcPkcsPadding,
  getRandomBytes as outerGetRandomBytes,
  hmacSha256,
  sha256,
  verifyHmacSha256,
  base64ToArrayBuffer,
  typedArrayToArrayBuffer,
} from '../Crypto';

declare global {
  // this is fixed in already, and won't be necessary when the new definitions
  // files are used: https://github.com/microsoft/TSJS-lib-generator/pull/843
  // We want to extend `SubtleCrypto`, so we need an interface.
  // eslint-disable-next-line no-restricted-syntax
  export interface SubtleCrypto {
    decrypt(
      algorithm:
        | string
        | RsaOaepParams
        | AesCtrParams
        | AesCbcParams
        | AesCmacParams
        | AesGcmParams
        | AesCfbParams,
      key: CryptoKey,
      data:
        | Int8Array
        | Int16Array
        | Int32Array
        | Uint8Array
        | Uint16Array
        | Uint32Array
        | Uint8ClampedArray
        | Float32Array
        | Float64Array
        | DataView
        | ArrayBuffer
    ): Promise<ArrayBuffer>;

    digest(
      algorithm: string | Algorithm,
      data:
        | Int8Array
        | Int16Array
        | Int32Array
        | Uint8Array
        | Uint16Array
        | Uint32Array
        | Uint8ClampedArray
        | Float32Array
        | Float64Array
        | DataView
        | ArrayBuffer
    ): Promise<ArrayBuffer>;

    importKey(
      format: 'raw' | 'pkcs8' | 'spki',
      keyData:
        | Int8Array
        | Int16Array
        | Int32Array
        | Uint8Array
        | Uint16Array
        | Uint32Array
        | Uint8ClampedArray
        | Float32Array
        | Float64Array
        | DataView
        | ArrayBuffer,
      algorithm:
        | string
        | RsaHashedImportParams
        | EcKeyImportParams
        | HmacImportParams
        | DhImportKeyParams
        | AesKeyAlgorithm,
      extractable: boolean,
      keyUsages: Array<string>
    ): Promise<CryptoKey>;

    importKey(
      format: string,
      keyData:
        | JsonWebKey
        | Int8Array
        | Int16Array
        | Int32Array
        | Uint8Array
        | Uint16Array
        | Uint32Array
        | Uint8ClampedArray
        | Float32Array
        | Float64Array
        | DataView
        | ArrayBuffer,
      algorithm:
        | string
        | RsaHashedImportParams
        | EcKeyImportParams
        | HmacImportParams
        | DhImportKeyParams
        | AesKeyAlgorithm,
      extractable: boolean,
      keyUsages: Array<string>
    ): Promise<CryptoKey>;
  }
}

const PROFILE_IV_LENGTH = 12; // bytes
const PROFILE_KEY_LENGTH = 32; // bytes
const PROFILE_TAG_LENGTH = 128; // bits

// bytes
export const PaddedLengths = {
  Name: [53, 257],
  About: [128, 254, 512],
  AboutEmoji: [32],
  PaymentAddress: [554],
};

type EncryptedAttachment = {
  ciphertext: ArrayBuffer;
  digest: ArrayBuffer;
};

async function verifyDigest(
  data: ArrayBuffer,
  theirDigest: ArrayBuffer
): Promise<void> {
  return window.crypto.subtle
    .digest({ name: 'SHA-256' }, data)
    .then(ourDigest => {
      const a = new Uint8Array(ourDigest);
      const b = new Uint8Array(theirDigest);
      let result = 0;
      for (let i = 0; i < theirDigest.byteLength; i += 1) {
        result |= a[i] ^ b[i];
      }
      if (result !== 0) {
        throw new Error('Bad digest');
      }
    });
}

const Crypto = {
  async decryptAttachment(
    encryptedBin: ArrayBuffer,
    keys: ArrayBuffer,
    theirDigest?: ArrayBuffer
  ): Promise<ArrayBuffer> {
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

    await verifyHmacSha256(ivAndCiphertext, macKey, mac, 32);

    if (theirDigest) {
      await verifyDigest(encryptedBin, theirDigest);
    }

    return decryptAes256CbcPkcsPadding(aesKey, ciphertext, iv);
  },

  async encryptAttachment(
    plaintext: ArrayBuffer,
    keys: ArrayBuffer,
    iv: ArrayBuffer
  ): Promise<EncryptedAttachment> {
    if (!(plaintext instanceof ArrayBuffer) && !ArrayBuffer.isView(plaintext)) {
      throw new TypeError(
        `\`plaintext\` must be an \`ArrayBuffer\` or \`ArrayBufferView\`; got: ${typeof plaintext}`
      );
    }

    if (keys.byteLength !== 64) {
      throw new Error('Got invalid length attachment keys');
    }
    if (iv.byteLength !== 16) {
      throw new Error('Got invalid length attachment iv');
    }
    const aesKey = keys.slice(0, 32);
    const macKey = keys.slice(32, 64);

    const ciphertext = await encryptAes256CbcPkcsPadding(aesKey, plaintext, iv);

    const ivAndCiphertext = new Uint8Array(16 + ciphertext.byteLength);
    ivAndCiphertext.set(new Uint8Array(iv));
    ivAndCiphertext.set(new Uint8Array(ciphertext), 16);

    const mac = await hmacSha256(macKey, ivAndCiphertext.buffer as ArrayBuffer);

    const encryptedBin = new Uint8Array(16 + ciphertext.byteLength + 32);
    encryptedBin.set(ivAndCiphertext);
    encryptedBin.set(new Uint8Array(mac), 16 + ciphertext.byteLength);
    const digest = await sha256(encryptedBin.buffer as ArrayBuffer);

    return {
      ciphertext: encryptedBin.buffer,
      digest,
    };
  },

  async encryptProfile(
    data: ArrayBuffer,
    key: ArrayBuffer
  ): Promise<ArrayBuffer> {
    const iv = outerGetRandomBytes(PROFILE_IV_LENGTH);
    if (key.byteLength !== PROFILE_KEY_LENGTH) {
      throw new Error('Got invalid length profile key');
    }
    if (iv.byteLength !== PROFILE_IV_LENGTH) {
      throw new Error('Got invalid length profile iv');
    }
    return window.crypto.subtle
      .importKey('raw', key, { name: 'AES-GCM' } as any, false, ['encrypt'])
      .then(async keyForEncryption =>
        window.crypto.subtle
          .encrypt(
            { name: 'AES-GCM', iv, tagLength: PROFILE_TAG_LENGTH },
            keyForEncryption,
            data
          )
          .then(ciphertext => {
            const ivAndCiphertext = new Uint8Array(
              PROFILE_IV_LENGTH + ciphertext.byteLength
            );
            ivAndCiphertext.set(new Uint8Array(iv));
            ivAndCiphertext.set(new Uint8Array(ciphertext), PROFILE_IV_LENGTH);
            return ivAndCiphertext.buffer;
          })
      );
  },

  async decryptProfile(
    data: ArrayBuffer,
    key: ArrayBuffer
  ): Promise<ArrayBuffer> {
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
    const error = new Error(); // save stack
    return window.crypto.subtle
      .importKey('raw', key, { name: 'AES-GCM' } as any, false, ['decrypt'])
      .then(async keyForEncryption =>
        window.crypto.subtle
          .decrypt(
            { name: 'AES-GCM', iv, tagLength: PROFILE_TAG_LENGTH },
            keyForEncryption,
            ciphertext
          )
          .catch((e: Error) => {
            if (e.name === 'OperationError') {
              // bad mac, basically.
              error.message =
                'Failed to decrypt profile data. Most likely the profile key has changed.';
              error.name = 'ProfileDecryptError';
              throw error;
            }

            return (undefined as unknown) as ArrayBuffer; // uses of this function are not guarded
          })
      );
  },

  async encryptProfileItemWithPadding(
    item: ArrayBuffer,
    profileKey: ArrayBuffer,
    paddedLengths: typeof PaddedLengths[keyof typeof PaddedLengths]
  ): Promise<ArrayBuffer> {
    const paddedLength = paddedLengths.find(
      (length: number) => item.byteLength <= length
    );
    if (!paddedLength) {
      throw new Error('Oversized value');
    }
    const padded = new Uint8Array(paddedLength);
    padded.set(new Uint8Array(item));
    return Crypto.encryptProfile(padded.buffer as ArrayBuffer, profileKey);
  },

  async decryptProfileName(
    encryptedProfileName: string,
    key: ArrayBuffer
  ): Promise<{ given: ArrayBuffer; family: ArrayBuffer | null }> {
    const data = base64ToArrayBuffer(encryptedProfileName);
    return Crypto.decryptProfile(data, key).then(decrypted => {
      const padded = new Uint8Array(decrypted);

      // Given name is the start of the string to the first null character
      let givenEnd;
      for (givenEnd = 0; givenEnd < padded.length; givenEnd += 1) {
        if (padded[givenEnd] === 0x00) {
          break;
        }
      }

      // Family name is the next chunk of non-null characters after that first null
      let familyEnd;
      for (
        familyEnd = givenEnd + 1;
        familyEnd < padded.length;
        familyEnd += 1
      ) {
        if (padded[familyEnd] === 0x00) {
          break;
        }
      }
      const foundFamilyName = familyEnd > givenEnd + 1;

      return {
        given: typedArrayToArrayBuffer(padded.slice(0, givenEnd)),
        family: foundFamilyName
          ? typedArrayToArrayBuffer(padded.slice(givenEnd + 1, familyEnd))
          : null,
      };
    });
  },

  getRandomBytes(size: number): ArrayBuffer {
    return outerGetRandomBytes(size);
  },
};

export default Crypto;
