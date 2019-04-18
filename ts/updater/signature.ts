import { createHash } from 'crypto';
import {
  createReadStream,
  readFile as readFileCallback,
  writeFile as writeFileCallback,
} from 'fs';
import { basename, dirname, join, resolve as resolvePath } from 'path';

import pify from 'pify';

import { BinaryType, sign, verify } from './curve';

const readFile = pify(readFileCallback);
const writeFile = pify(writeFileCallback);

export async function generateSignature(
  updatePackagePath: string,
  version: string,
  privateKeyPath: string
) {
  const privateKey = await loadHexFromPath(privateKeyPath);
  const message = await generateMessage(updatePackagePath, version);

  return sign(privateKey, message);
}

export async function verifySignature(
  updatePackagePath: string,
  version: string,
  publicKey: BinaryType
): Promise<boolean> {
  const signaturePath = getSignaturePath(updatePackagePath);
  const signature = await loadHexFromPath(signaturePath);
  const message = await generateMessage(updatePackagePath, version);

  return verify(publicKey, message, signature);
}

// Helper methods

async function generateMessage(
  updatePackagePath: string,
  version: string
): Promise<BinaryType> {
  const hash = await _getFileHash(updatePackagePath);
  const messageString = `${Buffer.from(hash).toString('hex')}-${version}`;

  return Buffer.from(messageString);
}

export async function writeSignature(
  updatePackagePath: string,
  version: string,
  privateKeyPath: string
) {
  const signaturePath = getSignaturePath(updatePackagePath);
  const signature = await generateSignature(
    updatePackagePath,
    version,
    privateKeyPath
  );
  await writeHexToPath(signaturePath, signature);
}

export async function _getFileHash(
  updatePackagePath: string
): Promise<BinaryType> {
  const hash = createHash('sha256');
  const stream = createReadStream(updatePackagePath);

  return new Promise((resolve, reject) => {
    stream.on('data', data => {
      hash.update(data);
    });
    stream.on('close', () => {
      resolve(hash.digest());
    });
    stream.on('error', error => {
      reject(error);
    });
  });
}

export function getSignatureFileName(fileName: string) {
  return `${fileName}.sig`;
}

export function getSignaturePath(updatePackagePath: string): string {
  const updateFullPath = resolvePath(updatePackagePath);
  const updateDir = dirname(updateFullPath);
  const updateFileName = basename(updateFullPath);

  return join(updateDir, getSignatureFileName(updateFileName));
}

export function hexToBinary(target: string): BinaryType {
  return Buffer.from(target, 'hex');
}

export function binaryToHex(data: BinaryType): string {
  return Buffer.from(data).toString('hex');
}

export async function loadHexFromPath(target: string): Promise<BinaryType> {
  const hexString = await readFile(target, 'utf8');

  return hexToBinary(hexString);
}

export async function writeHexToPath(target: string, data: BinaryType) {
  await writeFile(target, binaryToHex(data));
}
