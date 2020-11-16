// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

declare module 'curve25519-n' {
  export function generateKeyPair(
    privKey: Buffer
  ): { pubKey: Buffer; privKey: Buffer };

  export function calculateSignature(privKey: Buffer, message: Buffer): Buffer;

  export function verifySignature(
    publicKey: Buffer,
    message: Buffer,
    signature: Buffer
  ): Buffer;
}
