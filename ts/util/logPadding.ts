// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'stream';
import type { Duplex, Readable } from 'stream';

const PADDING_CHUNK_SIZE = 64 * 1024;

export function logPadSize(size: number): number {
  return Math.max(
    541,
    Math.floor(1.05 ** Math.ceil(Math.log(size) / Math.log(1.05)))
  );
}

/**
 * Creates iterator that yields zero-filled padding chunks.
 */
function* generatePadding(size: number) {
  const targetLength = logPadSize(size);
  const paddingSize = targetLength - size;
  const paddingChunks = Math.floor(paddingSize / PADDING_CHUNK_SIZE);
  const paddingChunk = new Uint8Array(PADDING_CHUNK_SIZE); // zero-filled
  for (let i = 0; i < paddingChunks; i += 1) {
    yield paddingChunk;
  }

  const paddingRemainder = new Uint8Array(paddingSize % PADDING_CHUNK_SIZE);
  if (paddingRemainder.byteLength > 0) {
    yield paddingRemainder;
  }
}

// Push as much padding as we can. If we reach the end
// of the padding, return true.
function pushPadding(
  paddingIterator: Iterator<Uint8Array>,
  readable: Readable
): boolean {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = paddingIterator.next();
    if (result.done) {
      break;
    }
    const keepGoing = readable.push(result.value);
    if (!keepGoing) {
      return false;
    }
  }
  return true;
}

/**
 * Appends zero-padding to the stream to a target bucket size.
 */
export function appendPaddingStream(): Duplex {
  let onReadableDrained: undefined | (() => void);
  let fileSize = 0;

  return new Transform({
    read(size) {
      // When in the process of pushing padding, we pause and wait for
      // read to be called again.
      if (onReadableDrained != null) {
        onReadableDrained();
      }
      // Always call _read, even if we're done.
      Transform.prototype._read.call(this, size);
    },
    transform(chunk, _encoding, callback) {
      fileSize += chunk.byteLength;
      callback(null, chunk);
    },
    flush(callback) {
      const iterator = generatePadding(fileSize);

      onReadableDrained = () => {
        if (!pushPadding(iterator, this)) {
          return;
        }

        callback();
      };
      onReadableDrained();
    },
  });
}
