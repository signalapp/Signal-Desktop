// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as client from '@signalapp/signal-client';

import { constantTimeEqual, typedArrayToArrayBuffer } from './Crypto';
import {
  KeyPairType,
  CompatPreKeyType,
  CompatSignedPreKeyType,
} from './textsecure/Types.d';

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

  if (
    !(identityKeyPair.privKey instanceof ArrayBuffer) ||
    identityKeyPair.privKey.byteLength !== 32 ||
    !(identityKeyPair.pubKey instanceof ArrayBuffer) ||
    identityKeyPair.pubKey.byteLength !== 33
  ) {
    throw new TypeError(
      'generateSignedPreKey: Invalid argument for identityKeyPair'
    );
  }

  const keyPair = generateKeyPair();
  const signature = calculateSignature(identityKeyPair.privKey, keyPair.pubKey);

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

export function generateKeyPair(): KeyPairType {
  const privKey = client.PrivateKey.generate();
  const pubKey = privKey.getPublicKey();

  return {
    privKey: typedArrayToArrayBuffer(privKey.serialize()),
    pubKey: typedArrayToArrayBuffer(pubKey.serialize()),
  };
}

export function copyArrayBuffer(source: ArrayBuffer): ArrayBuffer {
  const sourceArray = new Uint8Array(source);

  const target = new ArrayBuffer(source.byteLength);
  const targetArray = new Uint8Array(target);

  targetArray.set(sourceArray, 0);

  return target;
}

export function createKeyPair(incomingKey: ArrayBuffer): KeyPairType {
  const copy = copyArrayBuffer(incomingKey);
  clampPrivateKey(copy);
  if (!constantTimeEqual(copy, incomingKey)) {
    window.log.warn('createKeyPair: incoming private key was not clamped!');
  }

  const incomingKeyBuffer = Buffer.from(incomingKey);

  if (incomingKeyBuffer.length !== 32) {
    throw new Error('key must be 32 bytes long');
  }

  const privKey = client.PrivateKey.deserialize(incomingKeyBuffer);
  const pubKey = privKey.getPublicKey();

  return {
    privKey: typedArrayToArrayBuffer(privKey.serialize()),
    pubKey: typedArrayToArrayBuffer(pubKey.serialize()),
  };
}

export function calculateAgreement(
  pubKey: ArrayBuffer,
  privKey: ArrayBuffer
): ArrayBuffer {
  const privKeyBuffer = Buffer.from(privKey);

  const pubKeyObj = client.PublicKey.deserialize(
    Buffer.concat([
      Buffer.from([0x05]),
      Buffer.from(validatePubKeyFormat(pubKey)),
    ])
  );
  const privKeyObj = client.PrivateKey.deserialize(privKeyBuffer);
  const sharedSecret = privKeyObj.agree(pubKeyObj);
  return typedArrayToArrayBuffer(sharedSecret);
}

export function verifySignature(
  pubKey: ArrayBuffer,
  message: ArrayBuffer,
  signature: ArrayBuffer
): boolean {
  const pubKeyBuffer = Buffer.from(pubKey);
  const messageBuffer = Buffer.from(message);
  const signatureBuffer = Buffer.from(signature);

  const pubKeyObj = client.PublicKey.deserialize(pubKeyBuffer);
  const result = pubKeyObj.verify(messageBuffer, signatureBuffer);

  return result;
}

export function calculateSignature(
  privKey: ArrayBuffer,
  plaintext: ArrayBuffer
): ArrayBuffer {
  const privKeyBuffer = Buffer.from(privKey);
  const plaintextBuffer = Buffer.from(plaintext);

  const privKeyObj = client.PrivateKey.deserialize(privKeyBuffer);
  const signature = privKeyObj.sign(plaintextBuffer);
  return typedArrayToArrayBuffer(signature);
}

export function validatePubKeyFormat(pubKey: ArrayBuffer): ArrayBuffer {
  if (
    pubKey === undefined ||
    ((pubKey.byteLength !== 33 || new Uint8Array(pubKey)[0] !== 5) &&
      pubKey.byteLength !== 32)
  ) {
    throw new Error('Invalid public key');
  }
  if (pubKey.byteLength === 33) {
    return pubKey.slice(1);
  }

  return pubKey;
}

export function setPublicKeyTypeByte(publicKey: ArrayBuffer): void {
  const byteArray = new Uint8Array(publicKey);
  byteArray[0] = 5;
}

export function clampPrivateKey(privateKey: ArrayBuffer): void {
  const byteArray = new Uint8Array(privateKey);

  // eslint-disable-next-line no-bitwise
  byteArray[0] &= 248;
  // eslint-disable-next-line no-bitwise
  byteArray[31] &= 127;
  // eslint-disable-next-line no-bitwise
  byteArray[31] |= 64;
}
