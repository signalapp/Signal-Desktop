// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as client from '@signalapp/libsignal-client';
import type { KyberPreKeyRecord } from '@signalapp/libsignal-client';

import * as Bytes from './Bytes';
import { constantTimeEqual } from './Crypto';
import type {
  KeyPairType,
  CompatPreKeyType,
  CompatSignedPreKeyType,
} from './textsecure/Types.d';
import * as log from './logging/log';

export function isNonNegativeInteger(n: unknown): n is number {
  return typeof n === 'number' && n % 1 === 0 && n >= 0;
}

export function generateSignedPreKey(
  identityKeyPair: KeyPairType,
  keyId: number
): CompatSignedPreKeyType {
  if (!isNonNegativeInteger(keyId)) {
    throw new TypeError(
      `generateSignedPreKey: Invalid argument for keyId: ${keyId}`
    );
  }

  const keyPair = generateKeyPair();
  const signature = calculateSignature(
    identityKeyPair.privateKey,
    keyPair.publicKey.serialize()
  );

  return {
    keyId,
    keyPair,
    signature,
  };
}
export function generatePreKey(keyId: number): CompatPreKeyType {
  if (!isNonNegativeInteger(keyId)) {
    throw new TypeError(`generatePreKey: Invalid argument for keyId: ${keyId}`);
  }

  const keyPair = generateKeyPair();

  return {
    keyId,
    keyPair,
  };
}

export function generateKyberPreKey(
  identityKeyPair: KeyPairType,
  keyId: number
): KyberPreKeyRecord {
  if (!isNonNegativeInteger(keyId)) {
    throw new TypeError(
      `generateKyberPreKey: Invalid argument for keyId: ${keyId}`
    );
  }

  const keyPair = client.KEMKeyPair.generate();
  const signature = calculateSignature(
    identityKeyPair.privateKey,
    keyPair.getPublicKey().serialize()
  );
  return client.KyberPreKeyRecord.new(
    keyId,
    Date.now(),
    keyPair,
    Buffer.from(signature)
  );
}

export function generateKeyPair(): KeyPairType {
  const privKey = client.PrivateKey.generate();
  const pubKey = privKey.getPublicKey();

  return new client.IdentityKeyPair(pubKey, privKey);
}

export function createKeyPair(incomingKey: Uint8Array): KeyPairType {
  const copy = new Uint8Array(incomingKey);
  clampPrivateKey(copy);
  if (!constantTimeEqual(copy, incomingKey)) {
    log.warn('createKeyPair: incoming private key was not clamped!');
  }

  const incomingKeyBuffer = Buffer.from(incomingKey);

  if (incomingKeyBuffer.length !== 32) {
    throw new Error('key must be 32 bytes long');
  }

  const privKey = client.PrivateKey.deserialize(incomingKeyBuffer);
  const pubKey = privKey.getPublicKey();

  return new client.IdentityKeyPair(pubKey, privKey);
}

export function prefixPublicKey(pubKey: Uint8Array): Uint8Array {
  return Bytes.concatenate([
    new Uint8Array([0x05]),
    validatePubKeyFormat(pubKey),
  ]);
}

export function calculateAgreement(
  pubKey: client.PublicKey,
  privKey: client.PrivateKey
): Uint8Array {
  return privKey.agree(pubKey);
}

export function verifySignature(
  pubKey: client.PublicKey,
  message: Uint8Array,
  signature: Uint8Array
): boolean {
  const messageBuffer = Buffer.from(message);
  const signatureBuffer = Buffer.from(signature);

  return pubKey.verify(messageBuffer, signatureBuffer);
}

export function calculateSignature(
  privKey: client.PrivateKey,
  plaintext: Uint8Array
): Uint8Array {
  const plaintextBuffer = Buffer.from(plaintext);

  return privKey.sign(plaintextBuffer);
}

function validatePubKeyFormat(pubKey: Uint8Array): Uint8Array {
  if (
    pubKey === undefined ||
    ((pubKey.byteLength !== 33 || pubKey[0] !== 5) && pubKey.byteLength !== 32)
  ) {
    throw new Error('Invalid public key');
  }
  if (pubKey.byteLength === 33) {
    return pubKey.slice(1);
  }

  return pubKey;
}

export function setPublicKeyTypeByte(publicKey: Uint8Array): void {
  // eslint-disable-next-line no-param-reassign
  publicKey[0] = 5;
}

export function clampPrivateKey(privateKey: Uint8Array): void {
  // eslint-disable-next-line no-bitwise, no-param-reassign
  privateKey[0] &= 248;
  // eslint-disable-next-line no-bitwise, no-param-reassign
  privateKey[31] &= 127;
  // eslint-disable-next-line no-bitwise, no-param-reassign
  privateKey[31] |= 64;
}
