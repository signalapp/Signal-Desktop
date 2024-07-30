// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Transform } from 'node:stream';

/**
 * Truncates the stream to the target size.
 */
export function trimPadding(size: number): Transform {
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
