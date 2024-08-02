// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline, finished } from 'node:stream/promises';
import {
  inferChunkSize,
  DigestingWritable,
} from '@signalapp/libsignal-client/dist/incremental_mac';

import { ValidatingPassThrough } from '../../util/ValidatingPassThrough';

// Use uneven chunk size to trigger buffering
const CHUNK_SIZE = 13579;

function toChunkedReadable(buffer: Buffer): Readable {
  const chunked = new Array<Buffer>();
  for (let i = 0; i < buffer.byteLength; i += CHUNK_SIZE) {
    chunked.push(buffer.subarray(i, i + CHUNK_SIZE));
  }

  return Readable.from(chunked);
}

describe('ValidatingPassThrough', () => {
  it('should emit whole source stream', async () => {
    const source = randomBytes(10 * 1024 * 1024);
    const key = randomBytes(32);

    const chunkSize = inferChunkSize(source.byteLength);
    const writable = new DigestingWritable(key, chunkSize);
    await pipeline(Readable.from(source), writable);

    const digest = writable.getFinalDigest();
    const validator = new ValidatingPassThrough(key, chunkSize, digest);

    const received = new Array<Buffer>();
    validator.on('data', chunk => received.push(chunk));

    await Promise.all([
      pipeline(toChunkedReadable(source), validator),
      finished(validator),
    ]);

    const actual = Buffer.concat(received);
    assert.isTrue(actual.equals(source));
  });

  it('should emit error on digest mismatch', async () => {
    const source = randomBytes(10 * 1024 * 1024);
    const key = randomBytes(32);

    const chunkSize = inferChunkSize(source.byteLength);
    const writable = new DigestingWritable(key, chunkSize);
    await pipeline(Readable.from(source), writable);

    const digest = writable.getFinalDigest();
    const wrongKey = randomBytes(32);
    const validator = new ValidatingPassThrough(wrongKey, chunkSize, digest);

    validator.on('data', () => {
      throw new Error('Should not be called');
    });

    await assert.isRejected(
      pipeline(toChunkedReadable(source), validator),
      'Corrupted input data'
    );
  });
});
