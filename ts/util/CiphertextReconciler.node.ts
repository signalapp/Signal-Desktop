// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Writable } from 'node:stream';
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import binarySearch from 'binary-search';

import { CipherType, AES_KEY_LENGTH, IV_LENGTH } from '../types/Crypto.std.ts';
import { wrapEventEmitterOnce } from './wrapEventEmitterOnce.node.ts';

export type CiphertextReconcilerOptions = Readonly<{
  writableStream: Writable;
  read: (options: {
    start: number;
    end: number;
  }) => Promise<Uint8Array<ArrayBuffer>>;
  removeFile: () => Promise<void>;
}>;

/**
 * This class takes a potentially unordered stream of plaintext data, saves
 * it to a temporary encrypted file, and reconciles the data into an ordered
 * stream.
 *
 * The main usage for CiphertextReconciler is in tandem with mediabunny that has
 * to "walk back" to the metadata reserved at the beginning of the file and
 * update it before finishing transcoding of the video.
 *
 * Usage:
 *
 * const r = new CiphertextReconciler({ ... });
 * await r.write(header, 0);
 * await r.write(chunk, 100);
 * // Out of order write to update header
 * await r.write(updatedHeader, 5);
 *
 * // Get the iterator of reconciled data
 * r.reconcile();
 */
export class CiphertextReconciler {
  readonly #options: CiphertextReconcilerOptions;
  readonly #key = randomBytes(AES_KEY_LENGTH);
  #lastIv = randomBytes(IV_LENGTH);
  readonly #cipher = createCipheriv(
    // CBC allows us to use the last block as the iv for the next block which
    // enables seeking
    CipherType.AES256CBC,
    this.#key,
    this.#lastIv
  );
  #cipherOffset = 0;
  readonly #index = new Array<{
    targetOffset: number;
    targetLength: number;
    cipherOffset: number;
    cipherIv: Uint8Array<ArrayBuffer>;
  }>();
  #plaintextSize = 0;

  constructor(options: CiphertextReconcilerOptions) {
    this.#options = options;
    this.#cipher.setAutoPadding(false);
  }

  async write(data: Uint8Array<ArrayBuffer>, offset: number): Promise<void> {
    // Skip empty blocks to avoid padding them
    if (data.byteLength === 0) {
      return;
    }

    try {
      this.#index.push({
        targetOffset: offset,
        targetLength: data.byteLength,
        cipherOffset: this.#cipherOffset,
        cipherIv: this.#lastIv,
      });
      this.#plaintextSize = Math.max(
        this.#plaintextSize,
        offset + data.byteLength
      );

      let padded = data;
      if (padded.byteLength % IV_LENGTH !== 0) {
        padded = Buffer.concat([
          padded,
          Buffer.alloc(IV_LENGTH - (padded.byteLength % IV_LENGTH)),
        ]);
      }
      const ciphertext = this.#cipher.update(padded);
      this.#lastIv = ciphertext.subarray(-IV_LENGTH);
      this.#cipherOffset += ciphertext.byteLength;

      if (!this.#options.writableStream.write(ciphertext)) {
        await wrapEventEmitterOnce(this.#options.writableStream, 'drain');
      }
    } catch (error) {
      this.#options.writableStream.destroy();
      await this.#options.removeFile();
      throw error;
    }
  }

  async *reconcile(): AsyncIterable<Uint8Array<ArrayBuffer>> {
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    const onError = (error: unknown) => reject(error);
    this.#options.writableStream.once('error', onError);
    this.#options.writableStream.end(resolve);
    try {
      await promise;
    } finally {
      this.#options.writableStream.removeListener('error', onError);
    }

    try {
      yield* this.#reconcile();
    } finally {
      await this.#options.removeFile();
    }
  }

  get plaintextSize(): number {
    return this.#plaintextSize;
  }

  async *#reconcile(): AsyncIterable<Uint8Array<ArrayBuffer>> {
    // Get all boundaries between chunks in index
    let boundaries = new Array<number>();
    for (const entry of this.#index) {
      boundaries.push(
        entry.targetOffset,
        entry.targetOffset + entry.targetLength
      );
    }
    boundaries = Array.from(new Set(boundaries));
    boundaries.sort((a, b) => a - b);

    let copyOps = new Array<{
      targetOffset: number;
      targetLength: number;
      cipherOffset: number;
      cipherSkip: number;
      cipherIv: Uint8Array<ArrayBuffer>;
    }>();

    // Create copy operations, splitting each entry in index at boundaries
    for (const entry of this.#index) {
      const targetEnd = entry.targetOffset + entry.targetLength;

      const firstBoundary = binarySearch(
        boundaries,
        entry.targetOffset,
        boundaryComparator
      );
      const lastBoundary = binarySearch(
        boundaries,
        targetEnd,
        boundaryComparator
      );
      if (firstBoundary < 0 || lastBoundary < 0) {
        throw new Error('Boundary OOB');
      }

      let lastOffset = entry.targetOffset;
      for (let i = firstBoundary + 1; i <= lastBoundary; i += 1) {
        const boundary = boundaries.at(i);
        if (
          boundary == null ||
          lastOffset >= boundary ||
          targetEnd < boundary
        ) {
          throw new Error('Boundary OOB');
        }

        copyOps.push({
          targetOffset: lastOffset,
          targetLength: boundary - lastOffset,
          cipherOffset: entry.cipherOffset,
          cipherSkip: lastOffset - entry.targetOffset,
          cipherIv: entry.cipherIv,
        });
        lastOffset = boundary;
      }
    }

    // Sort copy operations
    // Note: .sort() is stable so entries with the same targetOffset will have
    // their order preserved.
    copyOps.sort((a, b) => a.targetOffset - b.targetOffset);

    // Filter out duplicates, keeping only the last operation
    copyOps = copyOps.filter((entry, index) => {
      const next = copyOps.at(index + 1);
      if (next == null) {
        return true;
      }

      return next.targetOffset !== entry.targetOffset;
    });

    // Write!
    let offset = 0;
    for (const op of copyOps) {
      if (op.targetOffset !== offset) {
        throw new Error('Source material has gaps');
      }
      offset += op.targetLength;

      const decipher = createDecipheriv(
        CipherType.AES256CBC,
        this.#key,
        op.cipherIv
      );
      decipher.setAutoPadding(false);

      // Add padding when necessary
      let end = op.cipherOffset + op.cipherSkip + op.targetLength;
      if (end % IV_LENGTH !== 0) {
        end += IV_LENGTH - (end % IV_LENGTH);
      }
      // oxlint-disable-next-line no-await-in-loop
      const ciphertext = await this.#options.read({
        start: op.cipherOffset,
        end,
      });
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      yield plaintext.subarray(op.cipherSkip, op.cipherSkip + op.targetLength);
      decipher.destroy();
    }
  }
}

function boundaryComparator(boundary: number, needle: number): number {
  return boundary - needle;
}
