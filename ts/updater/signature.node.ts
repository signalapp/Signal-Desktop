// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import {
  createReadStream,
  readFile as readFileCallback,
  writeFile as writeFileCallback,
} from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { basename, dirname, join, resolve as resolvePath } from 'node:path';

import pify from 'pify';

import { sign, verify } from './curve.node.js';

const readFile = pify(readFileCallback);
const writeFile = pify(writeFileCallback);

export async function generateSignature(
  updatePackagePath: string,
  version: string,
  privateKeyPath: string
): Promise<Uint8Array> {
  const privateKey = await loadHexFromPath(privateKeyPath);
  const message = await generateMessage(updatePackagePath, version);

  return sign(privateKey, message);
}

export async function verifySignature(
  updatePackagePath: string,
  version: string,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  const message = await generateMessage(updatePackagePath, version);

  return verify(publicKey, message, signature);
}

// Helper methods

async function generateMessage(
  updatePackagePath: string,
  version: string
): Promise<Uint8Array> {
  const hash = await _getFileHash(updatePackagePath);
  const messageString = `${Buffer.from(hash).toString('hex')}-${version}`;

  return Buffer.from(messageString);
}

export async function writeSignature(
  updatePackagePath: string,
  version: string,
  privateKeyPath: string
): Promise<Uint8Array> {
  const signaturePath = getSignaturePath(updatePackagePath);
  const signature = await generateSignature(
    updatePackagePath,
    version,
    privateKeyPath
  );
  await writeHexToPath(signaturePath, signature);

  return signature;
}

export async function _getFileHash(updatePackagePath: string): Promise<Buffer> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(updatePackagePath), hash);

  return hash.digest();
}

export function getSignatureFileName(fileName: string): string {
  return `${fileName}.sig`;
}

export function getSignaturePath(updatePackagePath: string): string {
  const updateFullPath = resolvePath(updatePackagePath);
  const updateDir = dirname(updateFullPath);
  const updateFileName = basename(updateFullPath);

  return join(updateDir, getSignatureFileName(updateFileName));
}

export function hexToBinary(target: string): Buffer {
  return Buffer.from(target, 'hex');
}

export function binaryToHex(data: Uint8Array): string {
  return Buffer.from(data).toString('hex');
}

export async function loadHexFromPath(target: string): Promise<Buffer> {
  const hexString = await readFile(target, 'utf8');

  return hexToBinary(hexString);
}

export async function writeHexToPath(
  target: string,
  data: Uint8Array
): Promise<void> {
  await writeFile(target, binaryToHex(data));
}
