// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MIMEType } from '../types/MIME.std.js';
import {
  IMAGE_BMP,
  IMAGE_GIF,
  IMAGE_ICO,
  IMAGE_JPEG,
  IMAGE_PNG,
  IMAGE_WEBP,
} from '../types/MIME.std.js';

/**
 * This follows the [MIME Sniffing Standard for images][0].
 *
 * [0]: https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern
 */
export function sniffImageMimeType(bytes: Uint8Array): undefined | MIMEType {
  for (let i = 0; i < TYPES.length; i += 1) {
    const type = TYPES[i];
    if (matchesType(bytes, type)) {
      return type.mimeType;
    }
  }
  return undefined;
}

type Type = {
  mimeType: MIMEType;
  bytePattern: Uint8Array;
  patternMask?: Uint8Array;
};
const TYPES: Array<Type> = [
  {
    mimeType: IMAGE_ICO,
    bytePattern: new Uint8Array([0x00, 0x00, 0x01, 0x00]),
  },
  {
    mimeType: IMAGE_ICO,
    bytePattern: new Uint8Array([0x00, 0x00, 0x02, 0x00]),
  },
  {
    mimeType: IMAGE_BMP,
    bytePattern: new Uint8Array([0x42, 0x4d]),
  },
  {
    mimeType: IMAGE_GIF,
    bytePattern: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
  },
  {
    mimeType: IMAGE_GIF,
    bytePattern: new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  },
  {
    mimeType: IMAGE_WEBP,
    bytePattern: new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      0x56, 0x50,
    ]),
    patternMask: new Uint8Array([
      0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff,
      0xff, 0xff,
    ]),
  },
  {
    mimeType: IMAGE_PNG,
    bytePattern: new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]),
  },
  {
    mimeType: IMAGE_JPEG,
    bytePattern: new Uint8Array([0xff, 0xd8, 0xff]),
  },
];

// This follows the [pattern matching algorithm in the spec][1].
// [1]: https://mimesniff.spec.whatwg.org/#pattern-matching-algorithm
function matchesType(input: Uint8Array, type: Type): boolean {
  if (input.byteLength < type.bytePattern.byteLength) {
    return false;
  }

  for (let p = 0; p < type.bytePattern.length; p += 1) {
    const mask = type.patternMask ? type.patternMask[p] : 0xff;
    // We need to use a bitwise operator here, per the spec.
    // eslint-disable-next-line no-bitwise
    const maskedData = input[p] & mask;
    if (maskedData !== type.bytePattern[p]) {
      return false;
    }
  }

  return true;
}
