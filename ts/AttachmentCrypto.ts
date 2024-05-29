// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { unlinkSync, createReadStream, createWriteStream } from 'fs';
import { open } from 'fs/promises';
import {
  createDecipheriv,
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'crypto';
import type { Decipher, Hash, Hmac } from 'crypto';
import { PassThrough, Transform, type Writable, Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { ensureFile } from 'fs-extra';
import * as log from './logging/log';
import { HashType, CipherType } from './types/Crypto';
import { createName, getRelativePath } from './windows/attachments';
import { constantTimeEqual } from './Crypto';
import { appendPaddingStream, logPadSize } from './util/logPadding';
import { prependStream } from './util/prependStream';
import { appendMacStream } from './util/appendMacStream';
import { Environment } from './environment';
import type { AttachmentType } from './types/Attachment';
import type { ContextType } from './types/Message2';
import { strictAssert } from './util/assert';
import * as Errors from './types/errors';
import { isNotNil } from './util/isNotNil';
import { missingCaseError } from './util/missingCaseError';

// This file was split from ts/Crypto.ts because it pulls things in from node, and
//   too many things pull in Crypto.ts, so it broke storybook.

const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const DIGEST_LENGTH = 32;
const HEX_DIGEST_LENGTH = DIGEST_LENGTH * 2;
const ATTACHMENT_MAC_LENGTH = 32;

export class ReencyptedDigestMismatchError extends Error {}

/** @private */
export const KEY_SET_LENGTH = KEY_LENGTH + ATTACHMENT_MAC_LENGTH;

export function _generateAttachmentIv(): Uint8Array {
  return randomBytes(IV_LENGTH);
}

export function generateAttachmentKeys(): Uint8Array {
  return randomBytes(KEY_SET_LENGTH);
}

export type EncryptedAttachmentV2 = {
  digest: Uint8Array;
  iv: Uint8Array;
  plaintextHash: string;
  ciphertextSize: number;
};

export type DecryptedAttachmentV2 = {
  path: string;
  iv: Uint8Array;
  plaintextHash: string;
};

export type PlaintextSourceType =
  | { data: Uint8Array }
  | { absolutePath: string };

export type HardcodedIVForEncryptionType =
  | {
      reason: 'test';
      iv: Uint8Array;
    }
  | {
      reason: 'reencrypting-for-backup';
      iv: Uint8Array;
      digestToMatch: Uint8Array;
    };

type EncryptAttachmentV2PropsType = {
  plaintext: PlaintextSourceType;
  keys: Readonly<Uint8Array>;
  dangerousIv?: HardcodedIVForEncryptionType;
  dangerousTestOnlySkipPadding?: boolean;
};

export async function encryptAttachmentV2ToDisk(
  args: EncryptAttachmentV2PropsType
): Promise<EncryptedAttachmentV2 & { path: string }> {
  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);

  await ensureFile(absoluteTargetPath);

  let encryptResult: EncryptedAttachmentV2;

  try {
    encryptResult = await encryptAttachmentV2({
      ...args,
      sink: createWriteStream(absoluteTargetPath),
    });
  } catch (error) {
    safeUnlinkSync(absoluteTargetPath);
    throw error;
  }

  return {
    ...encryptResult,
    path: relativeTargetPath,
  };
}
export async function encryptAttachmentV2({
  keys,
  plaintext,
  dangerousIv,
  dangerousTestOnlySkipPadding,
  sink,
}: EncryptAttachmentV2PropsType & {
  sink?: Writable;
}): Promise<EncryptedAttachmentV2> {
  const logId = 'encryptAttachmentV2';

  const { aesKey, macKey } = splitKeys(keys);

  if (dangerousIv) {
    if (dangerousIv.reason === 'test') {
      if (window.getEnvironment() !== Environment.Test) {
        throw new Error(
          `${logId}: Used dangerousIv with reason test outside tests!`
        );
      }
    } else if (dangerousIv.reason === 'reencrypting-for-backup') {
      strictAssert(
        dangerousIv.digestToMatch.byteLength === DIGEST_LENGTH,
        `${logId}: Must provide valid digest to match if providing iv for re-encryption`
      );
      log.info(
        `${logId}: using hardcoded iv because we are re-encrypting for backup`
      );
    } else {
      throw missingCaseError(dangerousIv);
    }
  }

  if (
    dangerousTestOnlySkipPadding &&
    window.getEnvironment() !== Environment.Test
  ) {
    throw new Error(
      `${logId}: Used dangerousTestOnlySkipPadding outside tests!`
    );
  }

  const iv = dangerousIv?.iv || _generateAttachmentIv();
  const plaintextHash = createHash(HashType.size256);
  const digest = createHash(HashType.size256);

  let ciphertextSize: number | undefined;

  try {
    const source =
      'data' in plaintext
        ? Readable.from([Buffer.from(plaintext.data)])
        : createReadStream(plaintext.absolutePath);

    await pipeline(
      [
        source,
        peekAndUpdateHash(plaintextHash),
        dangerousTestOnlySkipPadding ? undefined : appendPaddingStream(),
        createCipheriv(CipherType.AES256CBC, aesKey, iv),
        prependIv(iv),
        appendMacStream(macKey),
        peekAndUpdateHash(digest),
        measureSize(size => {
          ciphertextSize = size;
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

  const ourPlaintextHash = plaintextHash.digest('hex');
  const ourDigest = digest.digest();

  strictAssert(
    ourPlaintextHash.length === HEX_DIGEST_LENGTH,
    `${logId}: Failed to generate plaintext hash!`
  );

  strictAssert(
    ourDigest.byteLength === DIGEST_LENGTH,
    `${logId}: Failed to generate ourDigest!`
  );

  strictAssert(ciphertextSize != null, 'Failed to measure ciphertext size!');

  if (dangerousIv?.reason === 'reencrypting-for-backup') {
    if (!constantTimeEqual(ourDigest, dangerousIv.digestToMatch)) {
      throw new ReencyptedDigestMismatchError(
        `${logId}: iv was hardcoded for backup re-encryption, but digest does not match`
      );
    }
  }

  return {
    digest: ourDigest,
    iv,
    plaintextHash: ourPlaintextHash,
    ciphertextSize,
  };
}

type DecryptAttachmentOptionsType = Readonly<{
  ciphertextPath: string;
  idForLogging: string;
  aesKey: Readonly<Uint8Array>;
  macKey: Readonly<Uint8Array>;
  size: number;
  theirDigest: Readonly<Uint8Array>;
  outerEncryption?: {
    aesKey: Readonly<Uint8Array>;
    macKey: Readonly<Uint8Array>;
  };
}>;

export async function decryptAttachmentV2(
  options: DecryptAttachmentOptionsType
): Promise<DecryptedAttachmentV2> {
  const {
    idForLogging,
    macKey,
    aesKey,
    ciphertextPath,
    theirDigest,
    outerEncryption,
  } = options;

  const logId = `decryptAttachmentV2(${idForLogging})`;

  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);

  const digest = createHash(HashType.size256);
  const hmac = createHmac(HashType.size256, macKey);
  const plaintextHash = createHash(HashType.size256);
  let theirMac: Uint8Array | undefined;

  // When downloading from backup there is an outer encryption layer; in that case we
  // need to decrypt the outer layer and check its MAC
  let theirOuterMac: Uint8Array | undefined;
  const outerHmac = outerEncryption
    ? createHmac(HashType.size256, outerEncryption.macKey)
    : undefined;

  const maybeOuterEncryptionGetIvAndDecipher = outerEncryption
    ? getIvAndDecipher(outerEncryption.aesKey)
    : undefined;

  const maybeOuterEncryptionGetMacAndUpdateMac = outerHmac
    ? getMacAndUpdateHmac(outerHmac, theirOuterMacValue => {
        theirOuterMac = theirOuterMacValue;
      })
    : undefined;

  let readFd;
  let writeFd;
  let iv: Uint8Array | undefined;
  try {
    try {
      readFd = await open(ciphertextPath, 'r');
    } catch (cause) {
      throw new Error(`${logId}: Read path doesn't exist`, { cause });
    }
    try {
      await ensureFile(absoluteTargetPath);
      writeFd = await open(absoluteTargetPath, 'w');
    } catch (cause) {
      throw new Error(`${logId}: Failed to create write path`, { cause });
    }

    await pipeline(
      [
        readFd.createReadStream(),
        maybeOuterEncryptionGetMacAndUpdateMac,
        maybeOuterEncryptionGetIvAndDecipher,
        peekAndUpdateHash(digest),
        getMacAndUpdateHmac(hmac, theirMacValue => {
          theirMac = theirMacValue;
        }),
        getIvAndDecipher(aesKey, theirIv => {
          iv = theirIv;
        }),
        trimPadding(options.size),
        peekAndUpdateHash(plaintextHash),
        writeFd.createWriteStream(),
      ].filter(isNotNil)
    );
  } catch (error) {
    log.error(
      `${logId}: Failed to decrypt attachment`,
      Errors.toLogFormat(error)
    );
    safeUnlinkSync(absoluteTargetPath);
    throw error;
  } finally {
    await Promise.all([readFd?.close(), writeFd?.close()]);
  }

  const ourMac = hmac.digest();
  const ourDigest = digest.digest();
  const ourPlaintextHash = plaintextHash.digest('hex');

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
    ourPlaintextHash.length === HEX_DIGEST_LENGTH,
    `${logId}: Failed to generate file hash!`
  );

  if (!constantTimeEqual(ourMac, theirMac)) {
    throw new Error(`${logId}: Bad MAC`);
  }
  if (!constantTimeEqual(ourDigest, theirDigest)) {
    throw new Error(`${logId}: Bad digest`);
  }

  strictAssert(
    iv != null && iv.byteLength === IV_LENGTH,
    `${logId}: failed to find their iv`
  );

  if (outerEncryption) {
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
  }

  return {
    path: relativeTargetPath,
    iv,
    plaintextHash: ourPlaintextHash,
  };
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
  const aesKey = keys.subarray(0, KEY_LENGTH);
  const macKey = keys.subarray(KEY_LENGTH, KEY_SET_LENGTH);
  return { aesKey, macKey };
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

/**
 * Updates an hmac with the stream except for the last ATTACHMENT_MAC_LENGTH
 * bytes. The last ATTACHMENT_MAC_LENGTH bytes are passed to the callback.
 */
export function getMacAndUpdateHmac(
  hmac: Hmac,
  onTheirMac: (theirMac: Uint8Array) => void
): Transform {
  // Because we don't have a view of the entire stream, we don't know when we're
  // at the end. We need to omit the last ATTACHMENT_MAC_LENGTH bytes from
  // `hmac.update` so we only push what we know is not the mac.
  let maybeMacBytes = Buffer.alloc(0);

  function updateWithKnownNonMacBytes() {
    let knownNonMacBytes = null;
    if (maybeMacBytes.byteLength > ATTACHMENT_MAC_LENGTH) {
      knownNonMacBytes = maybeMacBytes.subarray(0, -ATTACHMENT_MAC_LENGTH);
      maybeMacBytes = maybeMacBytes.subarray(-ATTACHMENT_MAC_LENGTH);
      hmac.update(knownNonMacBytes);
    }
    return knownNonMacBytes;
  }

  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        maybeMacBytes = Buffer.concat([maybeMacBytes, chunk]);
        const knownNonMac = updateWithKnownNonMacBytes();
        callback(null, knownNonMac);
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        onTheirMac(maybeMacBytes);
        callback(null, null);
      } catch (error) {
        callback(error);
      }
    },
  });
}

/**
 * Gets the IV from the start of the stream and creates a decipher.
 * Then deciphers the rest of the stream.
 */
export function getIvAndDecipher(
  aesKey: Uint8Array,
  onFoundIv?: (iv: Buffer) => void
): Transform {
  let maybeIvBytes: Buffer | null = Buffer.alloc(0);
  let decipher: Decipher | null = null;
  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        // If we've already initialized the decipher, just pass the chunk through.
        if (decipher != null) {
          callback(null, decipher.update(chunk));
          return;
        }

        // Wait until we have enough bytes to get the iv to initialize the
        // decipher.
        maybeIvBytes = Buffer.concat([maybeIvBytes, chunk]);
        if (maybeIvBytes.byteLength < IV_LENGTH) {
          callback(null, null);
          return;
        }

        // Once we have enough bytes, initialize the decipher and pass the
        // remainder of the bytes through.
        const iv = maybeIvBytes.subarray(0, IV_LENGTH);
        const remainder = maybeIvBytes.subarray(IV_LENGTH);
        onFoundIv?.(iv);
        maybeIvBytes = null; // free memory
        decipher = createDecipheriv(CipherType.AES256CBC, aesKey, iv);
        callback(null, decipher.update(remainder));
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        strictAssert(decipher != null, 'decipher must be set');
        callback(null, decipher.final());
      } catch (error) {
        callback(error);
      }
    },
  });
}

/**
 * Truncates the stream to the target size.
 */
function trimPadding(size: number) {
  let total = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      const chunkSize = chunk.byteLength;
      const sizeLeft = size - total;
      if (sizeLeft >= chunkSize) {
        total += chunkSize;
        callback(null, chunk);
      } else if (sizeLeft > 0) {
        total += sizeLeft;
        callback(null, chunk.subarray(0, sizeLeft));
      } else {
        callback(null, null);
      }
    },
  });
}

export function measureSize(onComplete: (size: number) => void): Transform {
  let totalBytes = 0;
  const passthrough = new PassThrough();
  passthrough.on('data', chunk => {
    totalBytes += chunk.length;
  });
  passthrough.on('end', () => {
    onComplete(totalBytes);
  });
  return passthrough;
}

export function getAttachmentCiphertextLength(plaintextLength: number): number {
  const paddedPlaintextSize = logPadSize(plaintextLength);

  return (
    IV_LENGTH +
    getAesCbcCiphertextLength(paddedPlaintextSize) +
    ATTACHMENT_MAC_LENGTH
  );
}

export function getAesCbcCiphertextLength(plaintextLength: number): number {
  const AES_CBC_BLOCK_SIZE = 16;
  return (
    (1 + Math.floor(plaintextLength / AES_CBC_BLOCK_SIZE)) * AES_CBC_BLOCK_SIZE
  );
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

/**
 * Called during message schema migration. New messages downloaded should have
 * plaintextHash added automatically during decryption / writing to file system.
 */
export async function addPlaintextHashToAttachment(
  attachment: AttachmentType,
  { getAbsoluteAttachmentPath }: ContextType
): Promise<AttachmentType> {
  if (!attachment.path) {
    return attachment;
  }

  const plaintextHash = await getPlaintextHashForAttachmentOnDisk(
    getAbsoluteAttachmentPath(attachment.path)
  );

  if (!plaintextHash) {
    log.error('addPlaintextHashToAttachment: Failed to generate hash');
    return attachment;
  }

  return {
    ...attachment,
    plaintextHash,
  };
}

export async function getPlaintextHashForAttachmentOnDisk(
  absolutePath: string
): Promise<string | undefined> {
  let readFd;
  try {
    try {
      readFd = await open(absolutePath, 'r');
    } catch (error) {
      log.error('addPlaintextHashToAttachment: Target path does not exist');
      return undefined;
    }
    const hash = createHash(HashType.size256);
    await pipeline(readFd.createReadStream(), hash);
    const plaintextHash = hash.digest('hex');
    if (!plaintextHash) {
      log.error(
        'addPlaintextHashToAttachment: no hash generated from file; is the file empty?'
      );
      return;
    }
    return plaintextHash;
  } catch (error) {
    log.error('addPlaintextHashToAttachment: error during file read', error);
    return undefined;
  } finally {
    await readFd?.close();
  }
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
export function safeUnlinkSync(filePath: string): void {
  try {
    unlinkSync(filePath);
  } catch (error) {
    // Ignore if file doesn't exist
    if (error.code !== 'ENOENT') {
      log.error('Failed to unlink', error);
      throw error;
    }
  }
}
