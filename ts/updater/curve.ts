// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { randomBytes } from 'crypto';
import {
  calculateSignature,
  generateKeyPair,
  verifySignature,
} from 'curve25519-n';

export function keyPair(): Record<string, Buffer> {
  const privateKey = randomBytes(32);
  const { pubKey, privKey } = generateKeyPair(privateKey);

  return {
    publicKey: pubKey,
    privateKey: privKey,
  };
}

export function sign(privateKey: Buffer, message: Buffer): Buffer {
  return calculateSignature(privateKey, message);
}

export function verify(
  publicKey: Buffer,
  message: Buffer,
  signature: Buffer
): boolean {
  const failed = verifySignature(publicKey, message, signature);

  return !failed;
}
