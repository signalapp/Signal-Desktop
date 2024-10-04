// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'node:stream';
import { strictAssert } from './assert';

/**
 * Truncates the stream to the target size and analyzes padding type.
 */
export function trimPadding(
  size: number,
  onPaddingAnalyzed: ({
    isPaddingAllZeros,
  }: {
    isPaddingAllZeros: boolean;
  }) => void
): Transform {
  let total = 0;
  let seenNonZeroPadding = false;
  return new Transform({
    transform(chunk, _encoding, callback) {
      strictAssert(chunk instanceof Uint8Array, 'chunk must be Uint8Array');
      const chunkSize = chunk.byteLength;
      const sizeLeft = size - total;
      let paddingInThisChunk: Uint8Array | undefined;
      if (sizeLeft >= chunkSize) {
        total += chunkSize;
        callback(null, chunk);
      } else if (sizeLeft > 0) {
        total += sizeLeft;
        const data = chunk.subarray(0, sizeLeft);
        paddingInThisChunk = chunk.subarray(sizeLeft);
        callback(null, data);
      } else {
        paddingInThisChunk = chunk;
        callback(null, null);
      }

      if (
        paddingInThisChunk &&
        !seenNonZeroPadding &&
        !paddingInThisChunk.every(el => el === 0)
      ) {
        seenNonZeroPadding = true;
      }
    },
    flush(callback) {
      onPaddingAnalyzed({ isPaddingAllZeros: !seenNonZeroPadding });
      callback();
    },
  });
}
