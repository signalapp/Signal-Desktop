// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadImage, { LoadImageOptions } from 'blueimp-load-image';
import { IMAGE_JPEG } from '../types/MIME';
import { canvasToBlob } from './canvasToBlob';

const DEFAULT_JPEG_QUALITY = 0.85;

export async function autoOrientImage(blob: Blob): Promise<Blob> {
  const options: LoadImageOptions = {
    canvas: true,
    orientation: true,
  };

  try {
    const data = await loadImage(blob, options);
    const { image } = data;
    if (image instanceof HTMLCanvasElement) {
      // We `return await`, instead of just `return`, so we capture the rejection in this
      // try/catch block. See [this blog post][0] for more background.
      // [0]: https://jakearchibald.com/2017/await-vs-return-vs-return-await/
      return await canvasToBlob(image, IMAGE_JPEG, DEFAULT_JPEG_QUALITY);
    }
    throw new Error('image not a canvas');
  } catch (err) {
    const error = new Error('autoOrientImage: Failed to process image');
    error.originalError = err;
    throw error;
  }
}
