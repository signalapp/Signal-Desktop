// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { fromBase64, fromHex } from '../Bytes.std.js';

export enum HashType {
  size256 = 'sha256',
  size512 = 'sha512',
}

export enum CipherType {
  AES256CBC = 'aes-256-cbc',
  AES256CTR = 'aes-256-ctr',
  AES256GCM = 'aes-256-gcm',
}

export const UUID_BYTE_SIZE = 16;

export const IV_LENGTH = 16;

export const AES_KEY_LENGTH = 32;

export const MAC_LENGTH = 32;

export const ATTACHMENT_MAC_LENGTH = MAC_LENGTH;

export const DIGEST_LENGTH = 32;

export const PLAINTEXT_HASH_LENGTH = 32;

export const KEY_SET_LENGTH = AES_KEY_LENGTH + MAC_LENGTH;

export function isValidAttachmentKey(
  keyBase64: string | undefined
): keyBase64 is string {
  if (typeof keyBase64 !== 'string') {
    return false;
  }
  const bytes = fromBase64(keyBase64);
  return bytes.byteLength === KEY_SET_LENGTH;
}

export function isValidDigest(
  digestBase64: string | undefined
): digestBase64 is string {
  if (typeof digestBase64 !== 'string') {
    return false;
  }
  const bytes = fromBase64(digestBase64);
  return bytes.byteLength === DIGEST_LENGTH;
}

export function isValidPlaintextHash(
  plaintextHashHex: string | undefined
): plaintextHashHex is string {
  if (typeof plaintextHashHex !== 'string') {
    return false;
  }
  const bytes = fromHex(plaintextHashHex);
  return bytes.byteLength === PLAINTEXT_HASH_LENGTH;
}
