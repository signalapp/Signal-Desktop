// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { encode } from 'blurhash';

import { hslToRGB } from './hslToRGB.std.js';

export function randomBlurHash(): string {
  const data = new Uint8ClampedArray(2 * 2 * 4);
  for (let i = 0; i < data.byteLength; i += 4) {
    const { r, g, b } = hslToRGB(Math.random() * 360, 1, 0.5);

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 0xff;
  }
  return encode(
    data,
    2, // width
    2, // height
    2, // x components
    2 // y components
  );
}
