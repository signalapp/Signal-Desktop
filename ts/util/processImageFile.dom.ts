// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LoadImageOptions } from 'blueimp-load-image';
import loadImage from 'blueimp-load-image';
import { canvasToBytes } from './canvasToBytes.std.js';

export async function processImageFile(file: File): Promise<Uint8Array> {
  const { image } = await loadImage(file, {
    canvas: true,
    cover: true,
    crop: true,
    imageSmoothingQuality: 'medium',
    maxHeight: 512,
    maxWidth: 512,
    minHeight: 2,
    minWidth: 2,
    // `imageSmoothingQuality` is not present in `loadImage`'s types, but it is
    //   documented and supported. Updating DefinitelyTyped is the long-term solution
    //   here.
  } as LoadImageOptions);

  // NOTE: The types for `loadImage` say this can never be a canvas, but it will be if
  //   `canvas: true`, at least in our case. Again, updating DefinitelyTyped should
  //   address this.
  if (!(image instanceof HTMLCanvasElement)) {
    throw new Error('Loaded image was not a canvas');
  }

  return canvasToBytes(image);
}
