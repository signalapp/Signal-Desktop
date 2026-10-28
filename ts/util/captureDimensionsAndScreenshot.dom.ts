// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';

import type {
  AttachmentType,
  LocalAttachmentV2Type,
} from '../types/Attachment.std.ts';
import { type MIMEType, IMAGE_PNG } from '../types/MIME.std.ts';
import type { MakeVideoScreenshotResultType } from '../types/VisualAttachment.dom.ts';
import type { LoggerType } from '../types/Logging.std.ts';
import { getLocalAttachmentUrl } from './getLocalAttachmentUrl.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from './GoogleChrome.std.ts';
import { strictAssert } from './assert.std.ts';

const THUMBNAIL_SIZE = 150;
const THUMBNAIL_CONTENT_TYPE = IMAGE_PNG;

export async function captureDimensionsAndScreenshot(
  attachment: AttachmentType,
  options: { generateThumbnail: boolean },
  params: {
    writeNewAttachmentData: (
      data: Uint8Array<ArrayBuffer>
    ) => Promise<LocalAttachmentV2Type>;
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
    if (attachment.height && attachment.width && attachment.thumbnail?.path) {
      return attachment;
    }

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

  strictAssert(isVideoTypeSupported(contentType), 'enforced by early return');

  let updatedAttachment = attachment;
  if (!attachment.height || !attachment.width || !attachment.screenshot?.path) {
    try {
      const { blob, duration, width, height } = await makeVideoScreenshot({
        objectUrl: localUrl,
        contentType: THUMBNAIL_CONTENT_TYPE,
        logger,
      });
      const screenshotBuffer = await blobToArrayBuffer(blob);
      const screenshot = await writeNewAttachmentData(
        new Uint8Array(screenshotBuffer)
      );

      updatedAttachment = {
        ...attachment,
        duration,
        screenshot: {
          ...screenshot,
          contentType: THUMBNAIL_CONTENT_TYPE,
          width,
          height,
        },
        width,
        height,
      };
    } catch (error) {
      logger.error(
        'captureDimensionsAndScreenshot: error processing video; skipping screenshot generation',
        toLogFormat(error)
      );
    }
  }
  if (
    updatedAttachment.screenshot?.path &&
    !updatedAttachment.thumbnail?.path &&
    options.generateThumbnail
  ) {
    try {
      const screenshotUrl = getLocalAttachmentUrl(updatedAttachment.screenshot);

      const thumbnailBuffer = await blobToArrayBuffer(
        await makeImageThumbnail({
          size: THUMBNAIL_SIZE,
          objectUrl: screenshotUrl,
          contentType: THUMBNAIL_CONTENT_TYPE,
          logger,
        })
      );

      updatedAttachment = {
        ...updatedAttachment,
        thumbnail: {
          ...updatedAttachment.thumbnail,
          ...(await writeNewAttachmentData(new Uint8Array(thumbnailBuffer))),
          contentType: THUMBNAIL_CONTENT_TYPE,
          width: THUMBNAIL_SIZE,
          height: THUMBNAIL_SIZE,
        },
      };
    } catch (error) {
      logger.error(
        'captureDimensionsAndScreenshot: error processing video; skipping screenshot thumbnail generation',
        toLogFormat(error)
      );
    }
  }

  return updatedAttachment;
}
