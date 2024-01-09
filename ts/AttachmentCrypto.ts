// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable max-classes-per-file */

import {
  existsSync,
  createReadStream,
  createWriteStream,
  unlinkSync,
} from 'fs';
import {
  createDecipheriv,
  createCipheriv,
  createHash,
  createHmac,
} from 'crypto';
import type { Cipher, Decipher, Hash, Hmac } from 'crypto';
import { ensureFile } from 'fs-extra';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

import * as log from './logging/log';
import * as Errors from './types/errors';
import { HashType, CipherType } from './types/Crypto';

import { createName, getRelativePath } from './windows/attachments';
import {
  constantTimeEqual,
  getAttachmentSizeBucket,
  getRandomBytes,
  getZeroes,
  sha256,
} from './Crypto';
import { Environment } from './environment';
import type { AttachmentType } from './types/Attachment';
import type { ContextType } from './types/Message2';

// This file was split from ts/Crypto.ts because it pulls things in from node, and
//   too many things pull in Crypto.ts, so it broke storybook.

export const IV_LENGTH = 16;
export const KEY_LENGTH = 32;
export const DIGEST_LENGTH = 32;
export const ATTACHMENT_MAC_LENGTH = 32;

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
  if (keys.byteLength !== KEY_LENGTH * 2) {
    throw new Error(`${logId}: Got invalid length attachment keys`);
  }
  if (!existsSync(plaintextAbsolutePath)) {
    throw new Error(`${logId}: Target path doesn't exist!`);
  }

  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);
  await ensureFile(absoluteTargetPath);

  // Create start and end streams
  const readStream = createReadStream(plaintextAbsolutePath);
  const writeStream = createWriteStream(absoluteTargetPath);

  const aesKey = keys.slice(0, KEY_LENGTH);
  const macKey = keys.slice(KEY_LENGTH, KEY_LENGTH * 2);

  if (dangerousTestOnlyIv && window.getEnvironment() !== Environment.Test) {
    throw new Error(`${logId}: Used dangerousTestOnlyIv outside tests!`);
  }
  const iv = dangerousTestOnlyIv || getRandomBytes(16);

  const plaintextHashTransform = new DigestTransform();
  const addPaddingTransform = new AddPaddingTransform(size);
  const cipherTransform = new CipherTransform(iv, aesKey);
  const addIvTransform = new AddIvTransform(iv);
  const addMacTransform = new AddMacTransform(macKey);
  const digestTransform = new DigestTransform();

  try {
    await pipeline(
      readStream,
      plaintextHashTransform,
      addPaddingTransform,
      cipherTransform,
      addIvTransform,
      addMacTransform,
      digestTransform,
      writeStream
    );
  } catch (error) {
    try {
      readStream.close();
      writeStream.close();
    } catch (cleanupError) {
      log.error(
        `${logId}: Failed to clean up after error`,
        Errors.toLogFormat(cleanupError)
      );
    }

    if (existsSync(absoluteTargetPath)) {
      unlinkSync(absoluteTargetPath);
    }

    throw error;
  }

  const { digest: plaintextHash } = plaintextHashTransform;
  if (
    !plaintextHash ||
    !plaintextHash.byteLength ||
    plaintextHash.byteLength !== DIGEST_LENGTH
  ) {
    throw new Error(`${logId}: Failed to generate plaintext hash!`);
  }

  const { digest: ourDigest } = digestTransform;
  if (
    !ourDigest ||
    !ourDigest.byteLength ||
    ourDigest.byteLength !== DIGEST_LENGTH
  ) {
    throw new Error(`${logId}: Failed to generate ourDigest!`);
  }

  writeStream.close();
  readStream.close();

  return {
    path: relativeTargetPath,
    digest: ourDigest,
    plaintextHash: Buffer.from(plaintextHash).toString('hex'),
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
  if (keys.byteLength !== KEY_LENGTH * 2) {
    throw new Error(`${logId}: Got invalid length attachment keys`);
  }
  if (!existsSync(ciphertextPath)) {
    throw new Error(`${logId}: Target path doesn't exist!`);
  }

  // Create random output file
  const relativeTargetPath = getRelativePath(createName());
  const absoluteTargetPath =
    window.Signal.Migrations.getAbsoluteAttachmentPath(relativeTargetPath);
  await ensureFile(absoluteTargetPath);

  // Create start and end streams
  const readStream = createReadStream(ciphertextPath);
  const writeStream = createWriteStream(absoluteTargetPath);

  const aesKey = keys.slice(0, KEY_LENGTH);
  const macKey = keys.slice(KEY_LENGTH, KEY_LENGTH * 2);

  const digestTransform = new DigestTransform();
  const macTransform = new MacTransform(macKey);
  const decipherTransform = new DecipherTransform(aesKey);
  const coreDecryptionTransform = new CoreDecryptionTransform(
    decipherTransform
  );
  const limitLengthTransform = new LimitLengthTransform(size);
  const plaintextHashTransform = new DigestTransform();

  try {
    await pipeline(
      readStream,
      digestTransform,
      macTransform,
      coreDecryptionTransform,
      decipherTransform,
      limitLengthTransform,
      plaintextHashTransform,
      writeStream
    );
  } catch (error) {
    try {
      readStream.close();
      writeStream.close();
    } catch (cleanupError) {
      log.error(
        `${logId}: Failed to clean up after error`,
        Errors.toLogFormat(cleanupError)
      );
    }

    if (existsSync(absoluteTargetPath)) {
      unlinkSync(absoluteTargetPath);
    }

    throw error;
  }

  const { ourMac } = macTransform;
  const { theirMac } = coreDecryptionTransform;
  if (
    !ourMac ||
    !ourMac.byteLength ||
    ourMac.byteLength !== ATTACHMENT_MAC_LENGTH
  ) {
    throw new Error(`${logId}: Failed to generate ourMac!`);
  }
  if (
    !theirMac ||
    !theirMac.byteLength ||
    theirMac.byteLength !== ATTACHMENT_MAC_LENGTH
  ) {
    throw new Error(`${logId}: Failed to find theirMac!`);
  }
  if (!constantTimeEqual(ourMac, theirMac)) {
    throw new Error(`${logId}: Bad MAC`);
  }

  const { digest: ourDigest } = digestTransform;
  if (
    !ourDigest ||
    !ourDigest.byteLength ||
    ourDigest.byteLength !== DIGEST_LENGTH
  ) {
    throw new Error(`${logId}: Failed to generate ourDigest!`);
  }
  if (
    !theirDigest ||
    !theirDigest.byteLength ||
    theirDigest.byteLength !== DIGEST_LENGTH
  ) {
    throw new Error(`${logId}: Failed to find theirDigest!`);
  }
  if (!constantTimeEqual(ourDigest, theirDigest)) {
    throw new Error(`${logId}: Bad digest`);
  }

  const { digest: plaintextHash } = plaintextHashTransform;
  if (!plaintextHash || !plaintextHash.byteLength) {
    throw new Error(`${logId}: Failed to generate file hash!`);
  }

  writeStream.close();
  readStream.close();

  return {
    path: relativeTargetPath,
    plaintextHash: Buffer.from(plaintextHash).toString('hex'),
  };
}

// A very simple transform that doesn't modify the stream, but does calculate a digest
//   across all data it gets.
class DigestTransform extends Transform {
  private digestBuilder: Hash;
  public digest: Uint8Array | undefined;

  constructor() {
    super();
    this.digestBuilder = createHash(HashType.size256);
  }

  override _flush(done: (error?: Error) => void) {
    try {
      this.digest = this.digestBuilder.digest();
    } catch (error) {
      done(error);
      return;
    }

    done();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      this.digestBuilder.update(chunk);
      this.push(chunk);
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// A more complex transform that also doesn't modify the stream, calculating an HMAC
//   across everything but the last bytes of the stream.
class MacTransform extends Transform {
  public ourMac: Uint8Array | undefined;
  private macBuilder: Hmac;
  private lastBytes: Uint8Array | undefined;

  constructor(macKey: Uint8Array) {
    super();

    if (macKey.byteLength !== KEY_LENGTH) {
      throw new Error(
        `MacTransform: macKey should be ${KEY_LENGTH} bytes, got ${macKey.byteLength} bytes`
      );
    }

    this.macBuilder = createHmac('sha256', Buffer.from(macKey));
  }

  override _flush(done: (error?: Error) => void) {
    try {
      this.ourMac = this.macBuilder.digest();
    } catch (error) {
      done(error);
      return;
    }

    done();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      // We'll continue building up data if our chunk sizes are too small to fit MAC
      const data = this.lastBytes
        ? Buffer.concat([this.lastBytes, chunk])
        : chunk;

      // Compute new last bytes from this chunk
      const lastBytesIndex = Math.max(
        0,
        data.byteLength - ATTACHMENT_MAC_LENGTH
      );
      this.lastBytes = data.subarray(lastBytesIndex);

      // Update hmac with data we know is not the last bytes
      if (lastBytesIndex > 0) {
        this.macBuilder.update(data.subarray(0, lastBytesIndex));
      }

      this.push(chunk);
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// The core of the decryption algorithm - it grabs the iv and initializes the
//   DecipherTransform provided to it. It also modifies the stream, only passing on the
//   data between the iv and the mac at the end.
class CoreDecryptionTransform extends Transform {
  private lastBytes: Uint8Array | undefined;

  public iv: Uint8Array | undefined;
  public theirMac: Uint8Array | undefined;

  constructor(private decipherTransform: DecipherTransform) {
    super();
  }

  override _flush(done: (error?: Error) => void) {
    try {
      if (
        !this.lastBytes ||
        this.lastBytes.byteLength !== ATTACHMENT_MAC_LENGTH
      ) {
        throw new Error(
          `CoreDecryptionTransform: didn't get expected ${ATTACHMENT_MAC_LENGTH} bytes for mac, got ${this.lastBytes?.byteLength}!`
        );
      }

      this.theirMac = this.lastBytes;
    } catch (error) {
      done(error);
      return;
    }

    done();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      let data = chunk;

      // Grab the first bytes from data if we haven't already
      if (!this.iv) {
        this.iv = chunk.subarray(0, IV_LENGTH);
        data = chunk.subarray(IV_LENGTH);

        if (this.iv.byteLength !== IV_LENGTH) {
          throw new Error(
            `CoreDecryptionTransform: didn't get expected ${IV_LENGTH} bytes for iv, got ${this.iv.byteLength}!`
          );
        }

        this.decipherTransform.initializeDecipher(this.iv);
      }

      // Add previous last bytes to this new chunk
      if (this.lastBytes) {
        data = Buffer.concat([this.lastBytes, data]);
      }

      // Compute new last bytes from this chunk - if this chunk doesn't fit the MAC, we
      //   build across multiple chunks to get there.
      const macIndex = Math.max(0, data.byteLength - ATTACHMENT_MAC_LENGTH);
      this.lastBytes = data.subarray(macIndex);

      if (macIndex > 0) {
        this.push(data.subarray(0, macIndex));
      }
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// The transform that does the actual deciphering. It doesn't have enough information to
//   start working until the first chunk is processed upstream, hence its public
//   initializeDecipher() function.
class DecipherTransform extends Transform {
  private decipher: Decipher | undefined;

  constructor(private aesKey: Uint8Array) {
    super();

    if (aesKey.byteLength !== KEY_LENGTH) {
      throw new Error(
        `DecipherTransform: aesKey should be ${KEY_LENGTH} bytes, got ${aesKey.byteLength} bytes`
      );
    }
  }

  public initializeDecipher(iv: Uint8Array) {
    if (iv.byteLength !== IV_LENGTH) {
      throw new Error(
        `DecipherTransform: iv should be ${IV_LENGTH} bytes, got ${iv.byteLength} bytes`
      );
    }

    this.decipher = createDecipheriv(
      CipherType.AES256CBC,
      Buffer.from(this.aesKey),
      Buffer.from(iv)
    );
  }

  override _flush(done: (error?: Error) => void) {
    if (!this.decipher) {
      done(
        new Error(
          "DecipherTransform: _flush called, but decipher isn't initialized"
        )
      );
      return;
    }

    try {
      this.push(this.decipher.final());
    } catch (error) {
      done(error);
      return;
    }

    done();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!this.decipher) {
      done(
        new Error(
          "DecipherTransform: got a chunk, but decipher isn't initialized"
        )
      );
      return;
    }

    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      this.push(this.decipher.update(chunk));
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// A simple transform that limits the provided data to `size` bytes. We use this to
//   discard the padding on the incoming plaintext data.
class LimitLengthTransform extends Transform {
  private bytesWritten = 0;

  constructor(private size: number) {
    super();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      const chunkLength = chunk.byteLength;
      const sizeLeft = this.size - this.bytesWritten;

      if (sizeLeft >= chunkLength) {
        this.bytesWritten += chunkLength;
        this.push(chunk);
      } else if (sizeLeft > 0) {
        this.bytesWritten += sizeLeft;
        this.push(chunk.subarray(0, sizeLeft));
      }
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// This is an unusual transform, in that it can produce quite a bit more data than it is
//   provided. That's because it computes a bucket size for the provided size, which may
//   be quite a bit bigger than the attachment, and then needs to provide those zeroes
//   at the end of the stream.
const PADDING_CHUNK_SIZE = 64 * 1024;
class AddPaddingTransform extends Transform {
  private bytesWritten = 0;
  private targetLength: number;
  private paddingChunksToWrite: Array<number> = [];
  private paddingCallback: ((error?: Error) => void) | undefined;

  constructor(private size: number) {
    super();
    this.targetLength = getAttachmentSizeBucket(size);
  }

  override _read(size: number): void {
    if (this.paddingChunksToWrite.length > 0) {
      // Restart our efforts to push padding downstream
      this.pushPaddingChunks();
    } else {
      Transform.prototype._read.call(this, size);
    }
  }

  public pushPaddingChunks(): boolean {
    while (this.paddingChunksToWrite.length > 0) {
      const [first, ...rest] = this.paddingChunksToWrite;
      this.paddingChunksToWrite = rest;

      const zeroes = getZeroes(first);

      if (!this.push(zeroes)) {
        // We shouldn't push any more; if we have more to push, we'll do it after a read()
        break;
      }
    }

    if (this.paddingChunksToWrite.length > 0) {
      return false;
    }

    this.paddingCallback?.();
    return true;
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }
    try {
      const chunkLength = chunk.byteLength;
      const contentsStillNeeded = this.size - this.bytesWritten;

      if (contentsStillNeeded >= chunkLength) {
        this.push(chunk);
        this.bytesWritten += chunkLength;
      } else if (contentsStillNeeded > 0) {
        throw new Error(
          `AddPaddingTransform: chunk length was ${chunkLength} but only ${contentsStillNeeded} bytes needed to get to size ${this.size}`
        );
      }

      if (this.bytesWritten === this.size) {
        const paddingNeeded = this.targetLength - this.size;
        const chunks = Math.floor(paddingNeeded / PADDING_CHUNK_SIZE);
        const remainder = paddingNeeded % PADDING_CHUNK_SIZE;

        for (let i = 0; i < chunks; i += 1) {
          this.paddingChunksToWrite.push(PADDING_CHUNK_SIZE);
        }
        if (remainder > 0) {
          this.paddingChunksToWrite.push(remainder);
        }

        if (!this.pushPaddingChunks()) {
          // If we didn't push all chunks, we shouldn't call done - we'll keep it around
          //   to call when we're actually done.
          this.paddingCallback = done;
          return;
        }
      }
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// The transform that does the actual ciphering; quite simple in that it applies the
//   cipher to all incoming data, and can initialize itself fully in its constructor.
class CipherTransform extends Transform {
  private cipher: Cipher;

  constructor(private iv: Uint8Array, private aesKey: Uint8Array) {
    super();

    if (aesKey.byteLength !== KEY_LENGTH) {
      throw new Error(
        `CipherTransform: aesKey should be ${KEY_LENGTH} bytes, got ${aesKey.byteLength} bytes`
      );
    }
    if (iv.byteLength !== IV_LENGTH) {
      throw new Error(
        `CipherTransform: iv should be ${IV_LENGTH} bytes, got ${iv.byteLength} bytes`
      );
    }

    this.cipher = createCipheriv(
      CipherType.AES256CBC,
      Buffer.from(this.aesKey),
      Buffer.from(this.iv)
    );
  }

  override _flush(done: (error?: Error) => void) {
    try {
      this.push(this.cipher.final());
    } catch (error) {
      done(error);
      return;
    }

    done();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      this.push(this.cipher.update(chunk));
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// This very simple transform adds the provided iv data to the beginning of the stream.
class AddIvTransform extends Transform {
  public haveAddedIv = false;

  constructor(private iv: Uint8Array) {
    super();

    if (iv.byteLength !== IV_LENGTH) {
      throw new Error(
        `MacTransform: iv should be ${IV_LENGTH} bytes, got ${iv.byteLength} bytes`
      );
    }
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      if (!this.haveAddedIv) {
        this.push(this.iv);
        this.haveAddedIv = true;
      }
      this.push(chunk);
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// This transform both calculates the mac and adds it to the end of the stream.
class AddMacTransform extends Transform {
  public ourMac: Uint8Array | undefined;
  private macBuilder: Hmac;

  constructor(macKey: Uint8Array) {
    super();

    if (macKey.byteLength !== KEY_LENGTH) {
      throw new Error(
        `MacTransform: macKey should be ${KEY_LENGTH} bytes, got ${macKey.byteLength} bytes`
      );
    }

    this.macBuilder = createHmac('sha256', Buffer.from(macKey));
  }

  override _flush(done: (error?: Error) => void) {
    try {
      this.ourMac = this.macBuilder.digest();
      this.push(this.ourMac);
    } catch (error) {
      done(error);
      return;
    }

    done();
  }

  override _transform(
    chunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!chunk || chunk.byteLength === 0) {
      done();
      return;
    }

    try {
      this.macBuilder.update(chunk);
      this.push(chunk);
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

// Called during message schema migration. New messages downloaded should have
// plaintextHash added automatically during decryption / writing to file system.
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

async function getPlaintextHashForAttachmentOnDisk(
  absolutePath: string
): Promise<string | undefined> {
  const readStream = createReadStream(absolutePath);
  const hash = createHash(HashType.size256);
  try {
    await pipeline(readStream, hash);
    const plaintextHash = hash.digest();
    if (!plaintextHash) {
      log.error(
        'addPlaintextHashToAttachment: no hash generated from file; is the file empty?'
      );
      return;
    }
    return Buffer.from(plaintextHash).toString('hex');
  } catch (error) {
    log.error('addPlaintextHashToAttachment: error during file read', error);
    return undefined;
  } finally {
    readStream.close();
  }
}

export function getPlaintextHashForInMemoryAttachment(
  data: Uint8Array
): string {
  return Buffer.from(sha256(data)).toString('hex');
}
