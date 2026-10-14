// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import loadImage from 'blueimp-load-image';
import { Input, UrlSource, ALL_FORMATS, CanvasSink } from 'mediabunny';
import { blobToArrayBuffer } from 'blob-util';
import { toLogFormat } from './errors.std.ts';
import type { MIMEType } from './MIME.std.ts';
import { IMAGE_JPEG, IMAGE_PNG } from './MIME.std.ts';
import type { LoggerType } from './Logging.std.ts';
import { strictAssert } from '../util/assert.std.ts';
import { canvasToBlob } from '../util/canvasToBlob.std.ts';
import { KIBIBYTE } from './AttachmentSize.std.ts';
import { createLogger } from '../logging/log.std.ts';

const logging = createLogger('VisualAttachment');

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

    image.crossOrigin = 'anonymous';
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
  data: Uint8Array<ArrayBuffer>;
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

    image.crossOrigin = 'anonymous';
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
          // oxlint-disable-next-line no-await-in-loop
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

export type MakeVideoScreenshotResultType = Readonly<{
  blob: Blob;
  duration: number | undefined;
}>;

export async function makeVideoScreenshot({
  objectUrl,
  contentType = IMAGE_PNG,
}: MakeVideoScreenshotOptionsType): Promise<MakeVideoScreenshotResultType> {
  const source = new UrlSource(objectUrl);

  const input = new Input({
    formats: ALL_FORMATS,
    source,
  });

  const duration = await input.computeDuration();

  const track = await input.getPrimaryVideoTrack();
  if (track == null) {
    throw new Error('No video track');
  }

  const sink = new CanvasSink(track);

  const wrappedCanvas = await sink.getCanvas(0);
  if (wrappedCanvas == null) {
    throw new Error('No video frame');
  }

  const { canvas } = wrappedCanvas;
  strictAssert(canvas instanceof HTMLCanvasElement, 'Expected html canvas');

  const blob = await canvasToBlob(canvas, contentType);

  return {
    blob,
    duration,
  };
}

export function makeObjectUrl(
  data: Uint8Array<ArrayBuffer> | ArrayBuffer,
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
