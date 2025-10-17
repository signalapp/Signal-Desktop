// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'node:stream';
import { strictAssert } from './assert.std.js';

/**
 * Truncates the stream to the target size and analyzes padding type.
 */
export function trimPadding(size: number): Transform {
  let total = 0;
  return new Transform({
    transform(chunk, _encoding, callback) {
      strictAssert(chunk instanceof Uint8Array, 'chunk must be Uint8Array');
      const chunkSize = chunk.byteLength;
      const sizeLeft = size - total;
      if (sizeLeft >= chunkSize) {
        total += chunkSize;
        callback(null, chunk);
      } else if (sizeLeft > 0) {
        total += sizeLeft;
        const data = chunk.subarray(0, sizeLeft);
        callback(null, data);
      } else {
        callback(null, null);
      }
    },
    flush(callback) {
      callback();
    },
  });
}
