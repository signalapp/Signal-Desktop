// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadImage from 'blueimp-load-image';
import { blobToArrayBuffer } from 'blob-util';
import { toLogFormat } from './errors';
import type { MIMEType } from './MIME';
import { IMAGE_JPEG, IMAGE_PNG } from './MIME';
import type { LoggerType } from './Logging';
import { strictAssert } from '../util/assert';
import { canvasToBlob } from '../util/canvasToBlob';
import { KIBIBYTE } from './AttachmentSize';
import { explodePromise } from '../util/explodePromise';
import { SECOND } from '../util/durations';
import * as logging from '../logging/log';

export { blobToArrayBuffer };

export const MAX_BACKUP_THUMBNAIL_SIZE = 8 * KIBIBYTE;

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

export type MakeImageThumbnailForBackupOptionsType = Readonly<{
  maxDimension?: number;
  maxSize?: number;
  objectUrl: string;
}>;

// 0.7 quality seems to result in a good result in 1 interation for most images
const STARTING_JPEG_QUALITY = 0.7;
const MINIMUM_JPEG_QUALITY = 0.1;
const ADDITIONAL_QUALITY_DECREASE_PER_ITERATION = 0.1;

export type CreatedThumbnailType = {
  data: Uint8Array;
  height: number;
  width: number;
  mimeType: MIMEType;
};

export async function makeImageThumbnailForBackup({
  maxDimension = 256,
  maxSize = MAX_BACKUP_THUMBNAIL_SIZE,
  objectUrl,
}: MakeImageThumbnailForBackupOptionsType): Promise<CreatedThumbnailType> {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img');

    image.addEventListener('load', async () => {
      const start = performance.now();

      // Scale image to the right size and draw it on a canvas
      const canvas = loadImage.scale(image, {
        canvas: true,
        maxWidth: maxDimension,
        maxHeight: maxDimension,
      });

      strictAssert(
        canvas instanceof HTMLCanvasElement,
        'loadImage must produce canvas'
      );

      let jpegQuality = STARTING_JPEG_QUALITY;

      try {
        let blob = await canvasToBlob(canvas, IMAGE_JPEG, jpegQuality);
        let iterations = 1;

        while (
          blob.size > maxSize &&
          jpegQuality > MINIMUM_JPEG_QUALITY &&
          // iterations should be capped by the minimum JPEG quality condition, but for
          // peace of mind, let's cap them explicitly as well.
          iterations < 5
        ) {
          jpegQuality = Math.max(
            MINIMUM_JPEG_QUALITY,
            // In testing, the relationship between quality and size in this range is
            // relatively linear, so we guess at the appropriate quality by scaling by the
            // size and adding an additional quality decrease as a buffer
            (maxSize / blob.size) * jpegQuality -
              ADDITIONAL_QUALITY_DECREASE_PER_ITERATION
          );
          // eslint-disable-next-line no-await-in-loop
          blob = await canvasToBlob(canvas, IMAGE_JPEG, jpegQuality);
          iterations += 1;
        }

        const duration = (performance.now() - start).toFixed(1);

        const logMethod = blob.size > maxSize ? logging.warn : logging.info;
        const sizeInKiB = blob.size / KIBIBYTE;
        logMethod(
          'makeImageThumbnail: generated thumbnail of dimensions: ' +
            `${canvas.width} x ${canvas.height}, and size: ${sizeInKiB}(KiB) ` +
            `at quality: ${jpegQuality}, iterations: ${iterations}, time: ${duration}ms`
        );

        const buffer = await blobToArrayBuffer(blob);

        resolve({
          data: new Uint8Array(buffer),
          height: canvas.height,
          width: canvas.width,
          mimeType: IMAGE_JPEG,
        });
      } catch (err) {
        reject(err);
      }
    });

    image.addEventListener('error', error => {
      logging.error('makeImageThumbnail error', toLogFormat(error));
      reject(error);
    });

    image.src = objectUrl;
  });
}

export type MakeVideoScreenshotOptionsType = Readonly<{
  objectUrl: string;
  contentType?: MIMEType;
}>;

const MAKE_VIDEO_SCREENSHOT_TIMEOUT = 30 * SECOND;

function captureScreenshot(
  video: HTMLVideoElement,
  contentType: MIMEType
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  strictAssert(context, 'Failed to get canvas context');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas, contentType);
}

export async function makeVideoScreenshot({
  objectUrl,
  contentType = IMAGE_PNG,
}: MakeVideoScreenshotOptionsType): Promise<Blob> {
  const signal = AbortSignal.timeout(MAKE_VIDEO_SCREENSHOT_TIMEOUT);
  const video = document.createElement('video');

  const { promise: videoLoadedAndSeeked, resolve, reject } = explodePromise();

  function onLoaded() {
    if (signal.aborted) {
      return;
    }
    video.addEventListener('seeked', resolve);
    video.currentTime = 1.0;
  }

  function onAborted() {
    reject(signal.reason);
  }

  video.addEventListener('loadeddata', onLoaded);
  video.addEventListener('error', reject);
  signal.addEventListener('abort', onAborted);

  try {
    video.src = objectUrl;
    await videoLoadedAndSeeked;
    return await captureScreenshot(video, contentType);
  } catch (error) {
    logging.error('makeVideoScreenshot error:', toLogFormat(error));
    throw error;
  } finally {
    // hard reset the video element so it doesn't keep loading
    video.src = '';
    video.load();

    video.removeEventListener('loadeddata', onLoaded);
    video.removeEventListener('error', reject);
    video.removeEventListener('seeked', resolve);
    signal.removeEventListener('abort', onAborted);
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
