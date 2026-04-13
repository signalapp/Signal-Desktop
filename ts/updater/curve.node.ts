// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PrivateKey, PublicKey } from '@signalapp/libsignal-client';

export function sign(
  privateKey: Uint8Array<ArrayBuffer>,
  message: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> {
  const privKeyObj = PrivateKey.deserialize(privateKey);
  const signature = privKeyObj.sign(message);
  return signature;
}

export function verify(
  publicKey: Uint8Array<ArrayBuffer>,
  message: Uint8Array<ArrayBuffer>,
  signature: Uint8Array<ArrayBuffer>
): boolean {
  const pubKeyObj = PublicKey.deserialize(publicKey);
  const result = pubKeyObj.verify(message, signature);
  return result;
}
