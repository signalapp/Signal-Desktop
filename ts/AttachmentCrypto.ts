// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createReadStream, createWriteStream } from 'node:fs';
import { open, unlink, stat } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import type { Hash } from 'node:crypto';
import { PassThrough, Transform, type Writable, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import lodash from 'lodash';
import fsExtra from 'fs-extra';
import {
  chunkSizeInBytes,
  DigestingPassThrough,
  everyNthByte,
  inferChunkSize,
  ValidatingPassThrough,
} from '@signalapp/libsignal-client/dist/incremental_mac.js';
import type { ChunkSizeChoice } from '@signalapp/libsignal-client/dist/incremental_mac.js';
import { isAbsolute } from 'node:path';

import { createLogger } from './logging/log.std.js';
import {
  HashType,
  CipherType,
  IV_LENGTH,
  KEY_SET_LENGTH,
  PLAINTEXT_HASH_LENGTH,
  DIGEST_LENGTH,
  ATTACHMENT_MAC_LENGTH,
  AES_KEY_LENGTH,
} from './types/Crypto.std.js';
import { constantTimeEqual } from './Crypto.node.js';
import { createName, getRelativePath } from './util/attachmentPath.node.js';
import { appendPaddingStream } from './util/logPadding.node.js';
import { prependStream } from './util/prependStream.node.js';
import { appendMacStream } from './util/appendMacStream.node.js';
import { finalStream } from './util/finalStream.node.js';
import { getMacAndUpdateHmac } from './util/getMacAndUpdateHmac.node.js';
import { trimPadding } from './util/trimPadding.node.js';
import { assertDev, strictAssert } from './util/assert.std.js';
import * as Errors from './types/errors.std.js';
import { isNotNil } from './util/isNotNil.std.js';
import { missingCaseError } from './util/missingCaseError.std.js';
import { getEnvironment, Environment } from './environment.std.js';
import { isNotEmpty, toBase64, toHex } from './Bytes.std.js';
import { decipherWithAesKey } from './util/decipherWithAesKey.node.js';
import { getAttachmentCiphertextSize } from './util/AttachmentCrypto.std.js';
import { MediaTier } from './types/AttachmentDownload.std.js';

const { ensureFile } = fsExtra;

const { isNumber } = lodash;

const log = createLogger('AttachmentCrypto');

// This file was split from ts/Crypto.ts because it pulls things in from node, and
//   too many things pull in Crypto.ts, so it broke storybook.

export function _generateAttachmentIv(): Uint8Array {
  return randomBytes(IV_LENGTH);
}

export function generateAttachmentKeys(): Uint8Array {
  return randomBytes(KEY_SET_LENGTH);
}

export type EncryptedAttachmentV2 = {
  chunkSize: number | undefined;
  digest: Uint8Array;
  incrementalMac: Uint8Array | undefined;
  iv: Uint8Array;
  plaintextHash: string;
  ciphertextSize: number;
};

export type ReencryptedAttachmentV2 = {
  path: string;
  plaintextHash: string;
  digest: string;
  localKey: string;
  version: 2;
  size: number;
};

export type DecryptedAttachmentV2 = {
  path: string;
  digest: string;
  plaintextHash: string;
};

export type PlaintextSourceType =
  | { data: Uint8Array }
  | { stream: Readable; size?: number }
  | { absolutePath: string };

type EncryptAttachmentV2OptionsType = Readonly<{
  _testOnlyDangerousIv?: Uint8Array;
  _testOnlyDangerousSkipPadding?: boolean;
  keys: Readonly<Uint8Array>;
  needIncrementalMac: boolean;
  plaintext: PlaintextSourceType;
}>;

export type EncryptAttachmentV2ToDiskOptionsType =
  EncryptAttachmentV2OptionsType &
    Readonly<{
      getAbsoluteAttachmentPath: (relativePath: string) => string;
    }>;

export async function encryptAttachmentV2ToDisk(
  args: EncryptAttachmentV2ToDiskOptionsType
): Promise<EncryptedAttachmentV2 & { path: string }> {
  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath = args.getAbsoluteAttachmentPath(relativeTargetPath);

  await ensureFile(absoluteTargetPath);

  let encryptResult: EncryptedAttachmentV2;

  try {
    encryptResult = await encryptAttachmentV2({
      ...args,
      sink: createWriteStream(absoluteTargetPath),
    });
  } catch (error) {
    await safeUnlink(absoluteTargetPath);
    throw error;
  }

  return {
    ...encryptResult,
    path: relativeTargetPath,
  };
}
export async function encryptAttachmentV2({
  _testOnlyDangerousIv,
  _testOnlyDangerousSkipPadding,
  keys,
  needIncrementalMac,
  plaintext,
  sink,
}: EncryptAttachmentV2OptionsType & {
  sink?: Writable;
}): Promise<EncryptedAttachmentV2> {
  const logId = 'encryptAttachmentV2';

  const { aesKey, macKey } = splitKeys(keys);

  if (_testOnlyDangerousIv != null || _testOnlyDangerousSkipPadding != null) {
    if (getEnvironment() !== Environment.Test) {
      throw new Error(
        `${logId}: Used _testOnlyDangerousIv or _testOnlyDangerousSkipPadding outside tests!`
      );
    }
  }

  const iv = isNotEmpty(_testOnlyDangerousIv)
    ? _testOnlyDangerousIv
    : _generateAttachmentIv();
  const plaintextHash = createHash(HashType.size256);
  const digest = createHash(HashType.size256);

  let ciphertextSize: number | undefined;
  let mac: Uint8Array | undefined;
  let incrementalDigestCreator: DigestingPassThrough | undefined;
  let chunkSizeChoice: ChunkSizeChoice | undefined;

  try {
    let source: Readable;
    let size;
    if ('data' in plaintext) {
      const { data } = plaintext;
      source = Readable.from([Buffer.from(data)]);
      size = data.byteLength;
    } else if ('stream' in plaintext) {
      source = plaintext.stream;
      size = plaintext.size;
    } else {
      const { absolutePath } = plaintext;
      if (needIncrementalMac) {
        const fileData = await stat(absolutePath);
        size = fileData.size;
      }
      source = createReadStream(absolutePath);
    }

    if (needIncrementalMac) {
      strictAssert(
        isNumber(size),
        'Need size if we are to generate incrementalMac!'
      );
    }
    chunkSizeChoice = isNumber(size)
      ? inferChunkSize(
          getAttachmentCiphertextSize({
            unpaddedPlaintextSize: size,
            mediaTier: MediaTier.STANDARD,
          })
        )
      : undefined;
    incrementalDigestCreator =
      needIncrementalMac && chunkSizeChoice
        ? new DigestingPassThrough(Buffer.from(macKey), chunkSizeChoice)
        : undefined;

    await pipeline(
      [
        source,
        peekAndUpdateHash(plaintextHash),
        _testOnlyDangerousSkipPadding === true
          ? undefined
          : appendPaddingStream(),
        createCipheriv(CipherType.AES256CBC, aesKey, iv),
        prependIv(iv),
        appendMacStream(macKey, macValue => {
          mac = macValue;
        }),
        peekAndUpdateHash(digest),
        incrementalDigestCreator,
        measureSize({
          onComplete: finalSize => {
            ciphertextSize = finalSize;
          },
        }),
        sink ?? new PassThrough().resume(),
      ].filter(isNotNil)
    );
  } catch (error) {
    log.error(
      `${logId}: Failed to encrypt attachment`,
      Errors.toLogFormat(error)
    );
    throw error;
  }

  const ourPlaintextHash = plaintextHash.digest();
  const ourDigest = digest.digest();

  strictAssert(
    ourPlaintextHash.byteLength === PLAINTEXT_HASH_LENGTH,
    `${logId}: Failed to generate plaintext hash!`
  );

  strictAssert(
    ourDigest.byteLength === DIGEST_LENGTH,
    `${logId}: Failed to generate ourDigest!`
  );

  strictAssert(ciphertextSize != null, 'Failed to measure ciphertext size!');
  strictAssert(mac != null, 'Failed to compute mac!');

  const incrementalMac = incrementalDigestCreator?.getFinalDigest();

  return {
    chunkSize:
      incrementalMac && chunkSizeChoice
        ? chunkSizeInBytes(chunkSizeChoice)
        : undefined,
    ciphertextSize,
    digest: ourDigest,
    incrementalMac,
    iv,
    plaintextHash: toHex(ourPlaintextHash),
  };
}

export type IntegrityCheckType =
  | { type: 'plaintext'; plaintextHash: Readonly<Uint8Array> }
  | { type: 'encrypted'; digest: Readonly<Uint8Array> };

export type DecryptAttachmentToSinkOptionsType = Readonly<
  {
    idForLogging: string;
    size: number;
    outerEncryption?: {
      aesKey: Readonly<Uint8Array>;
      macKey: Readonly<Uint8Array>;
    };
  } & (
    | {
        ciphertextPath: string;
      }
    | {
        ciphertextStream: Readable;
      }
  ) &
    (
      | {
          type: 'standard';
          theirIncrementalMac: Readonly<Uint8Array> | undefined;
          theirChunkSize: number | undefined;
          integrityCheck: IntegrityCheckType;
        }
      | {
          // No need to check integrity for locally reencrypted attachments, or for backup
          // thumbnails (since we created it)
          type: 'local' | 'backupThumbnail';
        }
    ) &
    (
      | {
          aesKey: Readonly<Uint8Array>;
          macKey: Readonly<Uint8Array>;
        }
      | {
          // The format used by most stored attachments
          keysBase64: string;
        }
    )
>;

export type DecryptAttachmentOptionsType = DecryptAttachmentToSinkOptionsType &
  Readonly<{
    getAbsoluteAttachmentPath: (relativePath: string) => string;
  }>;

export async function decryptAttachmentV2(
  options: DecryptAttachmentOptionsType
): Promise<DecryptedAttachmentV2> {
  const logId = `decryptAttachmentV2(${options.idForLogging})`;

  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    options.getAbsoluteAttachmentPath(relativeTargetPath);

  let writeFd;
  try {
    try {
      await ensureFile(absoluteTargetPath);
      writeFd = await open(absoluteTargetPath, 'w');
    } catch (cause) {
      throw new Error(`${logId}: Failed to create write path`, { cause });
    }

    const result = await decryptAttachmentV2ToSink(
      options,
      writeFd.createWriteStream()
    );

    return {
      ...result,
      path: relativeTargetPath,
    };
  } catch (error) {
    log.error(
      `${logId}: Failed to decrypt attachment to disk`,
      Errors.toLogFormat(error)
    );
    await safeUnlink(absoluteTargetPath);
    throw error;
  } finally {
    await writeFd?.close();
  }
}

export async function decryptAttachmentV2ToSink(
  options: DecryptAttachmentToSinkOptionsType,
  sink: Writable
): Promise<Omit<DecryptedAttachmentV2, 'path'>> {
  const { idForLogging, outerEncryption } = options;

  let aesKey: Uint8Array;
  let macKey: Uint8Array;

  if ('aesKey' in options) {
    ({ aesKey, macKey } = options);
  } else {
    const { keysBase64 } = options;
    const keys = Buffer.from(keysBase64, 'base64');

    ({ aesKey, macKey } = splitKeys(keys));
  }

  const logId = `decryptAttachmentV2(${idForLogging})`;

  const digest = createHash(HashType.size256);
  const hmac = createHmac(HashType.size256, macKey);
  const plaintextHash = createHash(HashType.size256);

  const incrementalDigestValidator =
    options.type === 'standard' &&
    options.theirIncrementalMac &&
    options.theirChunkSize
      ? new ValidatingPassThrough(
          Buffer.from(macKey),
          everyNthByte(options.theirChunkSize),
          Buffer.from(options.theirIncrementalMac)
        )
      : undefined;

  let theirMac: Uint8Array | undefined;

  // When downloading from backup there is an outer encryption layer; in that case we
  // need to decrypt the outer layer and check its MAC
  let theirOuterMac: Uint8Array | undefined;
  const outerHmac = outerEncryption
    ? createHmac(HashType.size256, outerEncryption.macKey)
    : undefined;

  const maybeOuterEncryptionGetIvAndDecipher = outerEncryption
    ? decipherWithAesKey(outerEncryption.aesKey)
    : undefined;

  const maybeOuterEncryptionGetMacAndUpdateMac = outerHmac
    ? getMacAndUpdateHmac(outerHmac, theirOuterMacValue => {
        theirOuterMac = theirOuterMacValue;
      })
    : undefined;

  let readFd: FileHandle | undefined;
  let ourPlaintextHash: Uint8Array | undefined;
  let ourDigest: Uint8Array | undefined;
  let ciphertextStream: Readable;

  try {
    if ('ciphertextPath' in options) {
      try {
        readFd = await open(options.ciphertextPath, 'r');
        ciphertextStream = readFd.createReadStream();
      } catch (cause) {
        throw new Error(`${logId}: Read path doesn't exist`, { cause });
      }
    } else if ('ciphertextStream' in options) {
      ciphertextStream = options.ciphertextStream;
    } else {
      throw missingCaseError(options);
    }

    await pipeline(
      [
        ciphertextStream,
        maybeOuterEncryptionGetMacAndUpdateMac,
        maybeOuterEncryptionGetIvAndDecipher,
        peekAndUpdateHash(digest),
        incrementalDigestValidator,
        getMacAndUpdateHmac(hmac, theirMacValue => {
          theirMac = theirMacValue;
        }),
        decipherWithAesKey(aesKey),
        trimPadding(options.size),
        peekAndUpdateHash(plaintextHash),
        finalStream(() => {
          const ourMac = hmac.digest();
          ourDigest = digest.digest();
          ourPlaintextHash = plaintextHash.digest();

          strictAssert(
            ourMac.byteLength === ATTACHMENT_MAC_LENGTH,
            `${logId}: Failed to generate ourMac!`
          );
          strictAssert(
            theirMac != null && theirMac.byteLength === ATTACHMENT_MAC_LENGTH,
            `${logId}: Failed to find theirMac!`
          );
          strictAssert(
            ourDigest.byteLength === DIGEST_LENGTH,
            `${logId}: Failed to generate ourDigest!`
          );
          strictAssert(
            ourPlaintextHash.byteLength === DIGEST_LENGTH,
            `${logId}: Failed to generate ourPlaintextHash!`
          );

          if (!constantTimeEqual(ourMac, theirMac)) {
            throw new Error(`${logId}: Bad MAC`);
          }

          const { type } = options;
          switch (type) {
            case 'local':
            case 'backupThumbnail':
              // No integrity check needed, these are generated by us
              break;
            case 'standard':
              checkIntegrity({
                locallyCalculatedDigest: ourDigest,
                locallyCalculatedPlaintextHash: ourPlaintextHash,
                integrityCheck: options.integrityCheck,
                logId,
              });
              break;
            default:
              throw missingCaseError(type);
          }

          if (!outerEncryption) {
            return;
          }

          strictAssert(outerHmac, 'outerHmac must exist');

          const ourOuterMac = outerHmac.digest();
          strictAssert(
            ourOuterMac.byteLength === ATTACHMENT_MAC_LENGTH,
            `${logId}: Failed to generate ourOuterMac!`
          );
          strictAssert(
            theirOuterMac != null &&
              theirOuterMac.byteLength === ATTACHMENT_MAC_LENGTH,
            `${logId}: Failed to find theirOuterMac!`
          );

          if (!constantTimeEqual(ourOuterMac, theirOuterMac)) {
            throw new Error(`${logId}: Bad outer encryption MAC`);
          }
        }),
        sink,
      ].filter(isNotNil)
    );
  } catch (error) {
    // These errors happen when canceling fetch from `attachment://` urls,
    // ignore them to avoid noise in the logs.
    if (
      error.name === 'AbortError' ||
      error.code === 'ERR_STREAM_PREMATURE_CLOSE'
    ) {
      throw error;
    }

    log.error(
      `${logId}: Failed to decrypt attachment`,
      Errors.toLogFormat(error)
    );
    sink.end();
    throw error;
  } finally {
    await readFd?.close();
  }

  strictAssert(
    ourPlaintextHash != null && ourPlaintextHash.byteLength === DIGEST_LENGTH,
    `${logId}: Failed to generate plaintext hash!`
  );

  strictAssert(
    ourDigest != null && ourDigest.byteLength === DIGEST_LENGTH,
    `${logId}: Failed to generate digest!`
  );

  return {
    plaintextHash: toHex(ourPlaintextHash),
    digest: toBase64(ourDigest),
  };
}

export async function decryptAndReencryptLocally(
  options: DecryptAttachmentOptionsType
): Promise<ReencryptedAttachmentV2> {
  const { idForLogging, size } = options;
  const logId = `reencryptAttachmentV2(${idForLogging})`;

  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    options.getAbsoluteAttachmentPath(relativeTargetPath);

  let writeFd;
  try {
    try {
      await ensureFile(absoluteTargetPath);
      writeFd = await open(absoluteTargetPath, 'w');
    } catch (cause) {
      throw new Error(`${logId}: Failed to create write path`, { cause });
    }

    const keys = generateKeys();

    const passthrough = new PassThrough();
    const [result] = await Promise.all([
      decryptAttachmentV2ToSink(options, passthrough),
      await encryptAttachmentV2({
        keys,
        needIncrementalMac: false,
        plaintext: {
          stream: passthrough,
        },
        sink: createWriteStream(absoluteTargetPath),
      }),
    ]);

    return {
      localKey: toBase64(keys),
      path: relativeTargetPath,
      plaintextHash: result.plaintextHash,
      digest: result.digest,
      version: 2,
      size,
    };
  } catch (error) {
    log.error(
      `${logId}: Failed to decrypt and reencrypt attachment`,
      Errors.toLogFormat(error)
    );

    await safeUnlink(absoluteTargetPath);
    throw error;
  } finally {
    await writeFd?.close();
  }
}

/**
 * Splits the keys into aes and mac keys.
 */

type AttachmentEncryptionKeysType = {
  aesKey: Uint8Array;
  macKey: Uint8Array;
};
export function splitKeys(keys: Uint8Array): AttachmentEncryptionKeysType {
  strictAssert(
    keys.byteLength === KEY_SET_LENGTH,
    `attachment keys must be ${KEY_SET_LENGTH} bytes, got ${keys.byteLength}`
  );
  const aesKey = keys.subarray(0, AES_KEY_LENGTH);
  const macKey = keys.subarray(AES_KEY_LENGTH, KEY_SET_LENGTH);
  return { aesKey, macKey };
}

export function generateKeys(): Uint8Array {
  return randomBytes(KEY_SET_LENGTH);
}

/**
 * Updates a hash of the stream without modifying it.
 */
function peekAndUpdateHash(hash: Hash) {
  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        hash.update(chunk);
        callback(null, chunk);
      } catch (error) {
        callback(error);
      }
    },
  });
}

export function measureSize({
  downloadOffset = 0,
  onComplete,
  onSizeUpdate,
}: {
  downloadOffset?: number;
  onComplete: (size: number) => void;
  onSizeUpdate?: (size: number) => void;
}): Transform {
  let totalBytes = 0;

  const passthrough = new PassThrough();

  passthrough.on('data', chunk => {
    totalBytes += chunk.length;
    onSizeUpdate?.(totalBytes + downloadOffset);
  });
  passthrough.on('end', () => {
    onComplete(totalBytes);
  });

  return passthrough;
}

function checkIntegrity({
  locallyCalculatedDigest,
  locallyCalculatedPlaintextHash,
  integrityCheck,
  logId,
}: {
  locallyCalculatedDigest: Uint8Array;
  locallyCalculatedPlaintextHash: Uint8Array;
  integrityCheck: IntegrityCheckType;
  logId: string;
}): void {
  const { type } = integrityCheck;
  switch (type) {
    case 'encrypted':
      if (!constantTimeEqual(locallyCalculatedDigest, integrityCheck.digest)) {
        throw new Error(`${logId}: Bad digest`);
      }
      break;
    case 'plaintext':
      if (
        !constantTimeEqual(
          locallyCalculatedPlaintextHash,
          integrityCheck.plaintextHash
        )
      ) {
        throw new Error(`${logId}: Bad plaintextHash`);
      }
      break;
    default:
      throw missingCaseError(type);
  }
}

/**
 * Prepends the iv to the stream.
 */
function prependIv(iv: Uint8Array) {
  strictAssert(
    iv.byteLength === IV_LENGTH,
    `prependIv: iv should be ${IV_LENGTH} bytes, got ${iv.byteLength} bytes`
  );
  return prependStream(iv);
}

export function getPlaintextHashForInMemoryAttachment(
  data: Uint8Array
): string {
  return createHash(HashType.size256).update(data).digest('hex');
}

/**
 * Unlinks a file without throwing an error if it doesn't exist.
 * Throws an error if it fails to unlink for any other reason.
 */
export async function safeUnlink(absoluteFilePath: string): Promise<void> {
  assertDev(
    isAbsolute(absoluteFilePath),
    'safeUnlink: a relative path was passed instead of an absolute one'
  );

  try {
    await unlink(absoluteFilePath);
  } catch (error) {
    // Ignore if file doesn't exist

    if (error.code !== 'ENOENT') {
      log.error('Failed to unlink', error);
      throw error;
    }
  }
}
