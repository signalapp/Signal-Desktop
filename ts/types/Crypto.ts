// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

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

export const KEY_LENGTH = 32;

export const MAC_LENGTH = 32;
