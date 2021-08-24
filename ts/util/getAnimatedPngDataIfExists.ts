// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const ACTL_CHUNK_BYTES = new TextEncoder().encode('acTL');
const IDAT_CHUNK_BYTES = new TextEncoder().encode('IDAT');
const MAX_BYTES_TO_READ = 1024 * 1024;

type AnimatedPngData = {
  numPlays: number;
};

/**
 * This is a naïve implementation. It only performs two checks:
 *
 * 1. Do the bytes start with the [PNG signature][0]?
 * 2. If so, does it contain the [`acTL` chunk][1] before the [`IDAT` chunk][2], in the
 *    first megabyte?
 *
 * Though we _could_ only check for the presence of the `acTL` chunk anywhere, we make
 * sure it's before the `IDAT` chunk and within the first megabyte. This adds a small
 * amount of validity checking and helps us avoid problems with large PNGs.
 *
 * It doesn't make sure the PNG is valid. It doesn't verify [the CRC code][3] of each PNG
 * chunk; it doesn't verify any of the chunk's data; it doesn't verify that the chunks are
 * in the right order; etc.
 *
 * [0]: https://www.w3.org/TR/PNG/#5PNG-file-signature
 * [1]: https://wiki.mozilla.org/APNG_Specification#.60acTL.60:_The_Animation_Control_Chunk
 * [2]: https://www.w3.org/TR/PNG/#11IDAT
 * [3]: https://www.w3.org/TR/PNG/#5Chunk-layout
 */
export function getAnimatedPngDataIfExists(
  bytes: Uint8Array
): null | AnimatedPngData {
  if (!hasPngSignature(bytes)) {
    return null;
  }

  let numPlays: void | number;

  const dataView = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );

  let i = PNG_SIGNATURE.length;
  while (i < bytes.byteLength && i <= MAX_BYTES_TO_READ) {
    const chunkTypeBytes = bytes.slice(i + 4, i + 8);
    if (areBytesEqual(chunkTypeBytes, ACTL_CHUNK_BYTES)) {
      // 4 bytes for the length; 4 bytes for the type; 4 bytes for the number of frames.
      numPlays = dataView.getUint32(i + 12);
      if (numPlays === 0) {
        numPlays = Infinity;
      }
      return { numPlays };
    }
    if (areBytesEqual(chunkTypeBytes, IDAT_CHUNK_BYTES)) {
      return null;
    }

    // Jump over the length (4 bytes), the type (4 bytes), the data, and the CRC checksum
    //   (4 bytes).
    i += 12 + dataView.getUint32(i);
  }

  return null;
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return areBytesEqual(bytes.slice(0, 8), PNG_SIGNATURE);
}

function areBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  for (let i = 0; i < a.byteLength; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
