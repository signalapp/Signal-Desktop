// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';

import type {
  AttachmentType,
  LocalAttachmentV2Type,
} from '../types/Attachment.std.js';
import { type MIMEType, IMAGE_PNG } from '../types/MIME.std.js';
import type { MakeVideoScreenshotResultType } from '../types/VisualAttachment.dom.js';
import type { LoggerType } from '../types/Logging.std.js';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.js';
import { toLogFormat } from '../types/errors.std.js';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from './GoogleChrome.std.js';

const THUMBNAIL_SIZE = 150;
const THUMBNAIL_CONTENT_TYPE = IMAGE_PNG;

export async function captureDimensionsAndScreenshot(
  attachment: AttachmentType,
  options: { generateThumbnail: boolean },
  params: {
    writeNewAttachmentData: (
      data: Uint8Array
    ) => Promise<LocalAttachmentV2Type>;
    makeObjectUrl: (
      data: Uint8Array | ArrayBuffer,
      contentType: MIMEType
    ) => string;
    revokeObjectUrl: (path: string) => void;
    getImageDimensions: (params: {
      objectUrl: string;
      logger: LoggerType;
    }) => Promise<{
      width: number;
      height: number;
    }>;
    makeImageThumbnail: (params: {
      size: number;
      objectUrl: string;
      contentType: MIMEType;
      logger: LoggerType;
    }) => Promise<Blob>;
    makeVideoScreenshot: (params: {
      objectUrl: string;
      contentType: MIMEType;
      logger: LoggerType;
    }) => Promise<MakeVideoScreenshotResultType>;
    logger: LoggerType;
  }
): Promise<AttachmentType> {
  const { contentType } = attachment;

  const {
    writeNewAttachmentData,
    makeObjectUrl,
    revokeObjectUrl,
    getImageDimensions: getImageDimensionsFromURL,
    makeImageThumbnail,
    makeVideoScreenshot,
    logger,
  } = params;

  if (
    !isImageTypeSupported(contentType) &&
    !isVideoTypeSupported(contentType)
  ) {
    return attachment;
  }

  // If the attachment hasn't been downloaded yet, we won't have a path
  if (!attachment.path) {
    return attachment;
  }

  const localUrl = getLocalAttachmentUrl(attachment);

  if (isImageTypeSupported(contentType)) {
    try {
      const { width, height } = await getImageDimensionsFromURL({
        objectUrl: localUrl,
        logger,
      });
      let thumbnail: LocalAttachmentV2Type | undefined;

      if (options.generateThumbnail) {
        const thumbnailBuffer = await blobToArrayBuffer(
          await makeImageThumbnail({
            size: THUMBNAIL_SIZE,
            objectUrl: localUrl,
            contentType: THUMBNAIL_CONTENT_TYPE,
            logger,
          })
        );

        thumbnail = await writeNewAttachmentData(
          new Uint8Array(thumbnailBuffer)
        );
      }

      return {
        ...attachment,
        width,
        height,
        thumbnail: thumbnail
          ? {
              ...thumbnail,
              contentType: THUMBNAIL_CONTENT_TYPE,
              width: THUMBNAIL_SIZE,
              height: THUMBNAIL_SIZE,
            }
          : undefined,
      };
    } catch (error) {
      logger.error(
        'captureDimensionsAndScreenshot:',
        'error processing image; skipping screenshot generation',
        toLogFormat(error)
      );
      return attachment;
    }
  }

  let screenshotObjectUrl: string | undefined;
  try {
    const { blob, duration } = await makeVideoScreenshot({
      objectUrl: localUrl,
      contentType: THUMBNAIL_CONTENT_TYPE,
      logger,
    });
    const screenshotBuffer = await blobToArrayBuffer(blob);
    screenshotObjectUrl = makeObjectUrl(
      screenshotBuffer,
      THUMBNAIL_CONTENT_TYPE
    );
    const { width, height } = await getImageDimensionsFromURL({
      objectUrl: screenshotObjectUrl,
      logger,
    });
    const screenshot = await writeNewAttachmentData(
      new Uint8Array(screenshotBuffer)
    );

    let thumbnail: LocalAttachmentV2Type | undefined;
    if (options.generateThumbnail) {
      const thumbnailBuffer = await blobToArrayBuffer(
        await makeImageThumbnail({
          size: THUMBNAIL_SIZE,
          objectUrl: screenshotObjectUrl,
          contentType: THUMBNAIL_CONTENT_TYPE,
          logger,
        })
      );

      thumbnail = await writeNewAttachmentData(new Uint8Array(thumbnailBuffer));
    }

    return {
      ...attachment,
      duration,
      screenshot: {
        ...screenshot,
        contentType: THUMBNAIL_CONTENT_TYPE,
        width,
        height,
      },
      thumbnail: thumbnail
        ? {
            ...thumbnail,
            contentType: THUMBNAIL_CONTENT_TYPE,
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
          }
        : undefined,
      width,
      height,
    };
  } catch (error) {
    logger.error(
      'captureDimensionsAndScreenshot: error processing video; skipping screenshot generation',
      toLogFormat(error)
    );
    return attachment;
  } finally {
    if (screenshotObjectUrl !== undefined) {
      revokeObjectUrl(screenshotObjectUrl);
    }
  }
}
