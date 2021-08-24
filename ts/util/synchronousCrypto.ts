// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import crypto from 'crypto';

import { typedArrayToArrayBuffer as toArrayBuffer } from '../Crypto';

export function sign(key: ArrayBuffer, data: ArrayBuffer): ArrayBuffer {
  return toArrayBuffer(
    crypto
      .createHmac('sha256', Buffer.from(key))
      .update(Buffer.from(data))
      .digest()
  );
}

export enum HashType {
  size256 = 'sha256',
  size512 = 'sha512',
}

export function hash(type: HashType, data: ArrayBuffer): ArrayBuffer {
  return toArrayBuffer(
    crypto.createHash(type).update(Buffer.from(data)).digest()
  );
}

export enum CipherType {
  AES256CBC = 'aes-256-cbc',
  AES256CTR = 'aes-256-ctr',
}

export function encrypt(
  key: ArrayBuffer,
  data: ArrayBuffer,
  iv: ArrayBuffer,
  cipherType: CipherType = CipherType.AES256CBC
): ArrayBuffer {
  const cipher = crypto.createCipheriv(
    cipherType,
    Buffer.from(key),
    Buffer.from(iv)
  );
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(data)),
    cipher.final(),
  ]);

  return toArrayBuffer(encrypted);
}

export function decrypt(
  key: ArrayBuffer,
  data: ArrayBuffer,
  iv: ArrayBuffer,
  cipherType: CipherType = CipherType.AES256CBC
): ArrayBuffer {
  const cipher = crypto.createDecipheriv(
    cipherType,
    Buffer.from(key),
    Buffer.from(iv)
  );
  const decrypted = Buffer.concat([
    cipher.update(Buffer.from(data)),
    cipher.final(),
  ]);

  return toArrayBuffer(decrypted);
}
