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
