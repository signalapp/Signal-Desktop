// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { unlinkSync } from 'fs';
import { open } from 'fs/promises';
import {
  createDecipheriv,
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'crypto';
import type { Decipher, Hash, Hmac } from 'crypto';
import type { TransformCallback } from 'stream';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { ensureFile } from 'fs-extra';
import * as log from './logging/log';
import { HashType, CipherType } from './types/Crypto';
import { createName, getRelativePath } from './windows/attachments';
import { constantTimeEqual, getAttachmentSizeBucket } from './Crypto';
import { Environment } from './environment';
import type { AttachmentType } from './types/Attachment';
import type { ContextType } from './types/Message2';
import { strictAssert } from './util/assert';
import * as Errors from './types/errors';

// This file was split from ts/Crypto.ts because it pulls things in from node, and
//   too many things pull in Crypto.ts, so it broke storybook.

const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const DIGEST_LENGTH = 32;
const HEX_DIGEST_LENGTH = DIGEST_LENGTH * 2;
const ATTACHMENT_MAC_LENGTH = 32;

/** @private */
export const KEY_SET_LENGTH = KEY_LENGTH + ATTACHMENT_MAC_LENGTH;

export function _generateAttachmentIv(): Uint8Array {
  return randomBytes(IV_LENGTH);
}

export type EncryptedAttachmentV2 = {
  path: string;
  digest: Uint8Array;
  plaintextHash: string;
};

export type DecryptedAttachmentV2 = {
  path: string;
  plaintextHash: string;
};

export async function encryptAttachmentV2({
  keys,
  plaintextAbsolutePath,
  size,
  dangerousTestOnlyIv,
}: {
  keys: Readonly<Uint8Array>;
  plaintextAbsolutePath: string;
  size: number;
  dangerousTestOnlyIv?: Readonly<Uint8Array>;
}): Promise<EncryptedAttachmentV2> {
  const logId = 'encryptAttachmentV2';

  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);

  const { aesKey, macKey } = splitKeys(keys);

  if (dangerousTestOnlyIv && window.getEnvironment() !== Environment.Test) {
    throw new Error(`${logId}: Used dangerousTestOnlyIv outside tests!`);
  }
  const iv = dangerousTestOnlyIv || _generateAttachmentIv();

  const plaintextHash = createHash(HashType.size256);
  const digest = createHash(HashType.size256);

  let readFd;
  let writeFd;
  try {
    try {
      readFd = await open(plaintextAbsolutePath, 'r');
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
      readFd.createReadStream(),
      peekAndUpdateHash(plaintextHash),
      appendPadding(size),
      createCipheriv(CipherType.AES256CBC, aesKey, iv),
      prependIv(iv),
      appendMac(macKey),
      peekAndUpdateHash(digest),
      writeFd.createWriteStream()
    );
  } catch (error) {
    log.error(
      `${logId}: Failed to encrypt attachment`,
      Errors.toLogFormat(error)
    );
    safeUnlinkSync(absoluteTargetPath);
    throw error;
  } finally {
    await Promise.all([readFd?.close(), writeFd?.close()]);
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

  return {
    path: relativeTargetPath,
    digest: ourDigest,
    plaintextHash: ourPlaintextHash,
  };
}

export async function decryptAttachmentV2({
  ciphertextPath,
  id,
  keys,
  size,
  theirDigest,
}: {
  ciphertextPath: string;
  id: string;
  keys: Readonly<Uint8Array>;
  size: number;
  theirDigest: Readonly<Uint8Array>;
}): Promise<DecryptedAttachmentV2> {
  const logId = `decryptAttachmentV2(${id})`;

  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);

  const { aesKey, macKey } = splitKeys(keys);

  const digest = createHash(HashType.size256);
  const hmac = createHmac(HashType.size256, macKey);
  const plaintextHash = createHash(HashType.size256);
  let theirMac = null as Uint8Array | null; // TypeScript shenanigans

  let readFd;
  let writeFd;
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
      readFd.createReadStream(),
      peekAndUpdateHash(digest),
      getMacAndUpdateHmac(hmac, theirMacValue => {
        theirMac = theirMacValue;
      }),
      getIvAndDecipher(aesKey),
      trimPadding(size),
      peekAndUpdateHash(plaintextHash),
      writeFd.createWriteStream()
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

  return {
    path: relativeTargetPath,
    plaintextHash: ourPlaintextHash,
  };
}

/**
 * Splits the keys into aes and mac keys.
 */
function splitKeys(keys: Uint8Array) {
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
function getMacAndUpdateHmac(
  hmac: Hmac,
  onTheirMac: (theirMac: Uint8Array) => void
) {
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
function getIvAndDecipher(aesKey: Uint8Array) {
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

export function getAttachmentDownloadSize(size: number): number {
  return (
    // Multiply this by 1.05 to allow some variance
    getAttachmentSizeBucket(size) * 1.05 + IV_LENGTH + ATTACHMENT_MAC_LENGTH
  );
}

const PADDING_CHUNK_SIZE = 64 * 1024;

/**
 * Creates iterator that yields zero-filled padding chunks.
 */
function* generatePadding(size: number) {
  const targetLength = getAttachmentSizeBucket(size);
  const paddingSize = targetLength - size;
  const paddingChunks = Math.floor(paddingSize / PADDING_CHUNK_SIZE);
  const paddingChunk = new Uint8Array(PADDING_CHUNK_SIZE); // zero-filled
  const paddingRemainder = new Uint8Array(paddingSize % PADDING_CHUNK_SIZE);
  for (let i = 0; i < paddingChunks; i += 1) {
    yield paddingChunk;
  }
  if (paddingRemainder.byteLength > 0) {
    yield paddingRemainder;
  }
}

/**
 * Appends zero-padding to the stream to a target bucket size.
 */
function appendPadding(fileSize: number) {
  const iterator = generatePadding(fileSize);
  let bytesWritten = 0;
  let finalCallback: TransformCallback;

  // Push as much padding as we can. If we reach the end
  // of the padding, call the callback.
  function pushPadding(transform: Transform) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const result = iterator.next();
      if (result.done) {
        break;
      }
      const keepGoing = transform.push(result.value);
      if (!keepGoing) {
        return;
      }
    }
    finalCallback();
  }

  return new Transform({
    read(size) {
      // When in the process of pushing padding, we pause and wait for
      // read to be called again.
      if (finalCallback != null) {
        pushPadding(this);
      }
      // Always call _read, even if we're done.
      Transform.prototype._read.call(this, size);
    },
    transform(chunk, _encoding, callback) {
      bytesWritten += chunk.byteLength;
      // Once we reach the end of the file, start pushing padding.
      if (bytesWritten >= fileSize) {
        this.push(chunk);
        finalCallback = callback;
        pushPadding(this);
        return;
      }
      callback(null, chunk);
    },
  });
}

/**
 * Prepends the iv to the stream.
 */
function prependIv(iv: Uint8Array) {
  strictAssert(
    iv.byteLength === IV_LENGTH,
    `prependIv: iv should be ${IV_LENGTH} bytes, got ${iv.byteLength} bytes`
  );
  return new Transform({
    construct(callback) {
      this.push(iv);
      callback();
    },
    transform(chunk, _encoding, callback) {
      callback(null, chunk);
    },
  });
}

/**
 * Appends the mac to the end of the stream.
 */
function appendMac(macKey: Uint8Array) {
  strictAssert(
    macKey.byteLength === KEY_LENGTH,
    `macKey should be ${KEY_LENGTH} bytes, got ${macKey.byteLength} bytes`
  );
  const hmac = createHmac(HashType.size256, macKey);
  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        hmac.update(chunk);
        callback(null, chunk);
      } catch (error) {
        callback(error);
      }
    },
    flush(callback) {
      try {
        callback(null, hmac.digest());
      } catch (error) {
        callback(error);
      }
    },
  });
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
