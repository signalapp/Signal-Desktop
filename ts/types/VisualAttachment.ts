// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadImage from 'blueimp-load-image';
import { blobToArrayBuffer } from 'blob-util';
import { toLogFormat } from './errors';
import type { MIMEType } from './MIME';
import { IMAGE_PNG } from './MIME';
import type { LoggerType } from './Logging';
import { arrayBufferToObjectURL } from '../util/arrayBufferToObjectURL';
import { strictAssert } from '../util/assert';
import { canvasToBlob } from '../util/canvasToBlob';

export { blobToArrayBuffer };

export type GetImageDimensionsOptionsType = Readonly<{
  objectUrl: string;
  logger: Pick<LoggerType, 'error'>;
}>;

export function getImageDimensions({
  objectUrl,
  logger,
}: GetImageDimensionsOptionsType): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');

    image.addEventListener('load', () => {
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    });
    image.addEventListener('error', error => {
      logger.error('getImageDimensions error', toLogFormat(error));
      reject(error);
    });

    image.src = objectUrl;
  });
}

export type MakeImageThumbnailOptionsType = Readonly<{
  size: number;
  objectUrl: string;
  contentType?: MIMEType;
  logger: Pick<LoggerType, 'error'>;
}>;

export function makeImageThumbnail({
  size,
  objectUrl,
  contentType = IMAGE_PNG,
  logger,
}: MakeImageThumbnailOptionsType): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');

    image.addEventListener('load', async () => {
      // using components/blueimp-load-image

      // first, make the correct size
      let canvas = loadImage.scale(image, {
        canvas: true,
        cover: true,
        maxWidth: size,
        maxHeight: size,
        minWidth: size,
        minHeight: size,
      });

      // then crop
      canvas = loadImage.scale(canvas, {
        canvas: true,
        crop: true,
        maxWidth: size,
        maxHeight: size,
        minWidth: size,
        minHeight: size,
      });

      strictAssert(
        canvas instanceof HTMLCanvasElement,
        'loadImage must produce canvas'
      );

      try {
        const blob = await canvasToBlob(canvas, contentType);
        resolve(blob);
      } catch (err) {
        reject(err);
      }
    });

    image.addEventListener('error', error => {
      logger.error('makeImageThumbnail error', toLogFormat(error));
      reject(error);
    });

    image.src = objectUrl;
  });
}

export type MakeVideoScreenshotOptionsType = Readonly<{
  objectUrl: string;
  contentType?: MIMEType;
  logger: Pick<LoggerType, 'error'>;
}>;

export function makeVideoScreenshot({
  objectUrl,
  contentType = IMAGE_PNG,
  logger,
}: MakeVideoScreenshotOptionsType): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');

    function seek() {
      video.currentTime = 1.0;
    }

    async function capture() {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      strictAssert(context, 'Failed to get canvas context');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      video.removeEventListener('loadeddata', seek);
      video.removeEventListener('seeked', capture);

      try {
        const image = canvasToBlob(canvas, contentType);
        resolve(image);
      } catch (err) {
        reject(err);
      }
    }

    video.addEventListener('loadeddata', seek);
    video.addEventListener('seeked', capture);

    video.addEventListener('error', error => {
      logger.error('makeVideoScreenshot error', toLogFormat(error));
      reject(error);
    });

    video.src = objectUrl;
  });
}

export type MakeVideoThumbnailOptionsType = Readonly<{
  size: number;
  videoObjectUrl: string;
  logger: Pick<LoggerType, 'error'>;
  contentType: MIMEType;
}>;

export async function makeVideoThumbnail({
  size,
  videoObjectUrl,
  logger,
  contentType,
}: MakeVideoThumbnailOptionsType): Promise<Blob> {
  let screenshotObjectUrl: string | undefined;
  try {
    const blob = await makeVideoScreenshot({
      objectUrl: videoObjectUrl,
      contentType,
      logger,
    });
    const data = await blobToArrayBuffer(blob);
    screenshotObjectUrl = arrayBufferToObjectURL({
      data,
      type: contentType,
    });

    // We need to wait for this, otherwise the finally below will run first
    const resultBlob = await makeImageThumbnail({
      size,
      objectUrl: screenshotObjectUrl,
      contentType,
      logger,
    });

    return resultBlob;
  } finally {
    if (screenshotObjectUrl !== undefined) {
      revokeObjectUrl(screenshotObjectUrl);
    }
  }
}

export function makeObjectUrl(
  data: Uint8Array | ArrayBuffer,
  contentType: MIMEType
): string {
  const blob = new Blob([data], {
    type: contentType,
  });

  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(objectUrl: string): void {
  URL.revokeObjectURL(objectUrl);
}
