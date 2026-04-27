// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { PrivateKey } from '@signalapp/libsignal-client';

type KeyPair = Readonly<{
  publicKey: Uint8Array<ArrayBuffer>;
  privateKey: Uint8Array<ArrayBuffer>;
}>;

export function keyPair(): KeyPair {
  const privKey = PrivateKey.generate();
  const pubKey = privKey.getPublicKey();

  return {
    publicKey: pubKey.serialize(),
    privateKey: privKey.serialize(),
  };
}
