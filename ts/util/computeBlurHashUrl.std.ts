// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { decode } from 'blurhash';
import * as Bytes from '../Bytes.std.js';

const BITMAP_HEADER = new Uint8Array([
  // Header
  // See https://en.wikipedia.org/wiki/BMP_file_format#Bitmap_file_header

  // 0x00: BM
  0x42, 0x4d,
  // 0x02: Size = 3072 + 14 + 40
  0x36, 0x0c, 0x00, 0x00,
  // 0x06: Reserved
  0x00, 0x00, 0x00, 0x00,
  // 0x0a: Pixels Offset = 14 + 40
  0x36, 0x00, 0x00, 0x00,

  // BIP Header
  // See https://en.wikipedia.org/wiki/BMP_file_format#cite_ref-bmp_2-2

  // 0x0e: Size=40
  0x28, 0x00, 0x00, 0x00,

  // 0x12: Width=32
  0x20, 0x00, 0x00, 0x00,
  // 0x16: Height=-32 (top-down)
  0xe0, 0xff, 0xff, 0xff,
  // 0x1a: Num Color Planes
  0x01, 0x00,
  // 0x1c: Bits per Pixel = 24
  0x18, 0x00,
  // 0x1e: Compression Method
  0x00, 0x00, 0x00, 0x00,
  // 0x22: Image size = 3072
  0x00, 0x0c, 0x00, 0x00,
  // 0x26: Horizontal Resolution
  0x01, 0x00, 0x00, 0x00,
  // 0x2a: Vertical Resolution
  0x01, 0x00, 0x00, 0x00,
  // 0x2e: Number of Colors in Palette
  0x00, 0x00, 0x00, 0x00,
  // 0x32: Number of Important Colors
  0x00, 0x00, 0x00, 0x00,
]);

const PIXEL_COUNT = 32 * 32;

/* eslint-disable no-bitwise */
function writeUInt32LE(bytes: Uint8Array, value: number, position: number) {
  // eslint-disable-next-line no-param-reassign
  bytes[position + 0] = (value >>> 0) & 0xff;
  // eslint-disable-next-line no-param-reassign
  bytes[position + 1] = (value >>> 8) & 0xff;
  // eslint-disable-next-line no-param-reassign
  bytes[position + 2] = (value >>> 16) & 0xff;
  // eslint-disable-next-line no-param-reassign
  bytes[position + 3] = (value >>> 24) & 0xff;
}

export function computeBlurHashUrl(
  blurHash: string,
  // Square by default
  desiredWidth = 1,
  desiredHeight = 1
): string {
  const invAspect = Math.abs(desiredHeight) / (Math.abs(desiredWidth) + 1e-23);

  // Calculate width and height that roughly satisfy the desired PIXEL_COUNT
  //
  // height = invAspect * width
  // width * height = invAspect * width * width = PIXEL_COUNT
  let width = Math.sqrt(PIXEL_COUNT / (invAspect + 1e-23));
  width = Math.round(width);

  // Width has to be a multiple of DWORD size (4) for BMP to render image
  // correctly
  width >>= 2;
  width <<= 2;

  // Give at least two pixels of width to show gradients
  width = Math.max(2, width);

  let height = width * invAspect;
  height = Math.round(height);

  // Minimum two pixels of height for gradients
  height = Math.max(2, height);

  const rgba = decode(blurHash, width, height);
  const bgrSize = (rgba.byteLength / 4) * 3;
  const bitmap = new Uint8Array(BITMAP_HEADER.byteLength + bgrSize);

  bitmap.set(BITMAP_HEADER);

  // Update size
  writeUInt32LE(bitmap, bitmap.byteLength, 0x02);

  // Update width and height (has to be negative for top-down drawing)
  writeUInt32LE(bitmap, width, 0x12);
  writeUInt32LE(bitmap, -height, 0x16);

  // Update image size
  writeUInt32LE(bitmap, bgrSize, 0x22);

  // Copy pixels
  for (
    let i = 0, j = BITMAP_HEADER.byteLength;
    i < rgba.byteLength;
    i += 4, j += 3
  ) {
    // BMP uses BGR ordering
    bitmap[j + 2] = rgba[i];
    bitmap[j + 1] = rgba[i + 1];
    bitmap[j] = rgba[i + 2];
  }

  return `data:image/bmp;base64,${Bytes.toBase64(bitmap)}`;
}
/* eslint-enable no-bitwise */
