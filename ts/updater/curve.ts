// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PrivateKey, PublicKey } from '@signalapp/libsignal-client';

export function keyPair(): Record<string, Buffer> {
  const privKey = PrivateKey.generate();
  const pubKey = privKey.getPublicKey();

  return {
    publicKey: pubKey.serialize(),
    privateKey: privKey.serialize(),
  };
}

export function sign(privateKey: Buffer, message: Buffer): Buffer {
  const privKeyObj = PrivateKey.deserialize(privateKey);
  const signature = privKeyObj.sign(message);
  return signature;
}

export function verify(
  publicKey: Buffer,
  message: Buffer,
  signature: Buffer
): boolean {
  const pubKeyObj = PublicKey.deserialize(publicKey);
  const result = pubKeyObj.verify(message, signature);
  return result;
}
