// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import b64 from 'base64-js';

import type { ArtImageData } from '../types.d';
import {
  MIN_IMAGE_SIZE,
  STICKER_SIZE,
  MAX_STICKER_BYTE_SIZE,
  ArtType,
} from '../constants';
import { getFilePath } from './api';
import { getAnimatedPngDataIfExists } from './apng';
import { assert } from './assert';
import { loadImage } from './loadImage';

const WEBP_QUALITY = 0.8;

declare global {
  // eslint-disable-next-line no-restricted-syntax
  interface OffscreenCanvas {
    convertToBlob(options: { type: string; quality: number }): Promise<Blob>;
  }
}

async function convertCanvasToWebp(canvas: OffscreenCanvas): Promise<Blob> {
  return canvas.convertToBlob({
    type: 'image/webp',
    quality: WEBP_QUALITY,
  });
}

export class ProcessImageError extends Error {
  constructor(message: string, public readonly errorMessageI18nKey: string) {
    super(message);
  }
}

export async function processImage(
  file: File,
  artType: ArtType
): Promise<ArtImageData> {
  const imageData = new Uint8Array(await file.arrayBuffer());
  const image = await loadImage(imageData);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) {
    throw new ProcessImageError(
      'Image height or width were falsy',
      'StickerCreator--Toasts--errorProcessing'
    );
  }

  let contentType: string;
  let processedBuffer;

  assert(artType === ArtType.Sticker, 'Unexpected ArtType');
  const maxByteSize = MAX_STICKER_BYTE_SIZE;
  const targetSize = STICKER_SIZE;

  // For APNG we do something simpler: validate the file size
  //   and dimensions without resizing, cropping, or converting. In a perfect world, we'd
  //   resize and convert any animated image (GIF, animated WebP) to APNG.
  const animatedPngDataIfExists = getAnimatedPngDataIfExists(imageData);
  if (animatedPngDataIfExists) {
    if (width !== height) {
      throw new ProcessImageError(
        'Image must be square',
        'StickerCreator--Toasts--APNG--notSquare'
      );
    }
    if (imageData.length > maxByteSize) {
      throw new ProcessImageError(
        'Image file was too large',
        'StickerCreator--Toasts--tooLarge'
      );
    }
    if (width < MIN_IMAGE_SIZE) {
      throw new ProcessImageError(
        'Sticker dimensions are too small',
        'StickerCreator--Toasts--APNG--dimensionsTooSmall'
      );
    }
    if (width > targetSize) {
      throw new ProcessImageError(
        'Image dimensions are too large',
        'StickerCreator--Toasts--APNG--dimensionsTooLarge'
      );
    }
    if (animatedPngDataIfExists.numPlays !== Infinity) {
      throw new ProcessImageError(
        'Animated images must loop forever',
        'StickerCreator--Toasts--mustLoopForever'
      );
    }
    contentType = 'image/png';
    processedBuffer = imageData;
  } else {
    const canvas = new OffscreenCanvas(targetSize, targetSize);

    const context = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!context) {
      throw new Error('Failed to get 2d context of canvas');
    }

    const scaleFactor = targetSize / Math.max(width, height);
    const newWidth = width * scaleFactor;
    const newHeight = height * scaleFactor;
    const dx = (targetSize - newWidth) / 2;
    const dy = (targetSize - newHeight) / 2;

    context.drawImage(image, dx, dy, newWidth, newHeight);

    const blob = await convertCanvasToWebp(canvas);

    contentType = blob.type;
    processedBuffer = new Uint8Array(await blob.arrayBuffer());

    if (!processedBuffer || processedBuffer.length > maxByteSize) {
      throw new ProcessImageError(
        'Sticker file was too large',
        'StickerCreator--Toasts--tooLarge'
      );
    }
  }

  return {
    path: getFilePath(file) || file.name,
    buffer: processedBuffer,
    src: `data:${contentType};base64,${b64.fromByteArray(processedBuffer)}`,
    contentType,
  };
}
