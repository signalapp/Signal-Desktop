// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PrivateKey, PublicKey } from '@signalapp/libsignal-client';

export function keyPair(): Record<string, Uint8Array> {
  const privKey = PrivateKey.generate();
  const pubKey = privKey.getPublicKey();

  return {
    publicKey: pubKey.serialize(),
    privateKey: privKey.serialize(),
  };
}

export function sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array {
  const privKeyObj = PrivateKey.deserialize(privateKey);
  const signature = privKeyObj.sign(message);
  return signature;
}

export function verify(
  publicKey: Uint8Array,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  const pubKeyObj = PublicKey.deserialize(publicKey);
  const result = pubKeyObj.verify(message, signature);
  return result;
}
