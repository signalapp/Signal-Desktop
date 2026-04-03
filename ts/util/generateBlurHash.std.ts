// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { encode } from 'blurhash';

/**
 * This generates a blurhash for a single pixel of a given color.
 *
 * The color is specified as an ARGB value, where the alpha channel is ignored.
 */
export function generateBlurHash(argb = 0xff_fbfbfb): string {
  return encode(
    new Uint8ClampedArray([
      // Flipping from argb to rgba
      // oxlint-disable-next-line no-bitwise
      0xff & (argb >> 16), // R
      // oxlint-disable-next-line no-bitwise
      0xff & (argb >> 8), // G
      // oxlint-disable-next-line no-bitwise
      0xff & (argb >> 0), // B
      0xff, // A (ignored)
    ]),
    1, // width (data is just one pixel)
    1, // height (data is just one pixel)
    1, // x components (just the average color)
    1 // y components (just the average color)
  );
}
