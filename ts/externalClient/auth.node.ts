// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';

// Ed25519 keys and handshake transcripts for external clients. All
// cryptography comes from node:crypto; nothing here is hand-rolled.
//
// Client proof:  sign(clientKey, CLIENT_LABEL || 0 || sessionId || 0 || challenge)
// Server proof:  sign(serverKey, SERVER_LABEL || 0 || sessionId || 0 || challenge
//                                || 0 || clientNonce)
// Labels keep a signature for one purpose from being valid for the other.

const CLIENT_LABEL = 'signal-external-client/v1/client-auth';
const SERVER_LABEL = 'signal-external-client/v1/server-auth';

export type ServerKeyType = Readonly<{
  // PKCS#8 DER, base64. Stored only in the encrypted database.
  privateKey: string;
  // Raw 32-byte public key, base64url.
  publicKey: string;
}>;

export function encodeBase64Url(bytes: Uint8Array<ArrayBuffer>): string {
  return Buffer.from(bytes).toString('base64url');
}

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

const SEPARATOR = new Uint8Array([0]);
const encoder = new TextEncoder();

function transcript(
  parts: ReadonlyArray<string | Uint8Array<ArrayBuffer>>
): Uint8Array<ArrayBuffer> {
  const chunks = new Array<Uint8Array<ArrayBuffer>>();
  parts.forEach((part, index) => {
    if (index > 0) {
      chunks.push(SEPARATOR);
    }
    chunks.push(typeof part === 'string' ? encoder.encode(part) : part);
  });
  const result = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

export function clientTranscript(
  sessionId: string,
  challenge: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> {
  return transcript([CLIENT_LABEL, sessionId, challenge]);
}

export function serverTranscript(
  sessionId: string,
  challenge: Uint8Array<ArrayBuffer>,
  clientNonce: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> {
  return transcript([SERVER_LABEL, sessionId, challenge, clientNonce]);
}

function publicKeyFromRaw(publicKey: string): KeyObject | undefined {
  try {
    return createPublicKey({
      key: { kty: 'OKP', crv: 'Ed25519', x: publicKey },
      format: 'jwk',
    });
  } catch {
    return undefined;
  }
}

export function verifySignature(
  publicKey: string,
  data: Uint8Array<ArrayBuffer>,
  signature: string
): boolean {
  const key = publicKeyFromRaw(publicKey);
  if (!key) {
    return false;
  }
  try {
    return verify(null, data, key, decodeBase64Url(signature));
  } catch {
    return false;
  }
}

export function generateServerKey(): ServerKeyType {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  if (typeof jwk.x !== 'string') {
    throw new Error('generateServerKey: missing public key');
  }
  return {
    privateKey: privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64'),
    publicKey: jwk.x,
  };
}

export function signWithServerKey(
  serverKey: ServerKeyType,
  data: Uint8Array<ArrayBuffer>
): string {
  const key = createPrivateKey({
    key: Buffer.from(serverKey.privateKey, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  return encodeBase64Url(sign(null, data, key));
}

// Short, human-comparable fingerprint shown in the approval prompt and logs.
export function getKeyFingerprint(publicKey: string): string {
  const hex = createHash('sha256')
    .update(decodeBase64Url(publicKey))
    .digest('hex')
    .slice(0, 16);
  return hex.match(/.{4}/g)?.join(' ') ?? hex;
}
