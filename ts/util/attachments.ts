// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { omit } from 'lodash';
import { blobToArrayBuffer } from 'blob-util';

import { scaleImageToLevel } from './scaleImageToLevel';
import type { AttachmentType } from '../types/Attachment';
import { canBeTranscoded } from '../types/Attachment';
import type { LoggerType } from '../types/Logging';
import * as MIME from '../types/MIME';
import * as Errors from '../types/errors';

// Upgrade steps
// NOTE: This step strips all EXIF metadata from JPEG images as
// part of re-encoding the image:
export async function autoOrientJPEG(
  attachment: AttachmentType,
  { logger }: { logger: LoggerType },
  {
    sendHQImages = false,
    isIncoming = false,
  }: {
    sendHQImages?: boolean;
    isIncoming?: boolean;
  } = {}
): Promise<AttachmentType> {
  if (isIncoming && !MIME.isJPEG(attachment.contentType)) {
    return attachment;
  }

  if (!canBeTranscoded(attachment)) {
    return attachment;
  }

  // If we haven't downloaded the attachment yet, we won't have the data.
  // All images go through handleImageAttachment before being sent and thus have
  // already been scaled to level, oriented, stripped of exif data, and saved
  // in high quality format. If we want to send the image in HQ we can return
  // the attachment as-is. Otherwise we'll have to further scale it down.
  if (!attachment.data || sendHQImages) {
    return attachment;
  }

  const dataBlob = new Blob([attachment.data], {
    type: attachment.contentType,
  });
  try {
    const { blob: xcodedDataBlob } = await scaleImageToLevel(
      dataBlob,
      attachment.contentType,
      isIncoming
    );
    const xcodedDataArrayBuffer = await blobToArrayBuffer(xcodedDataBlob);

    // IMPORTANT: We overwrite the existing `data` `Uint8Array` losing the original
    // image data. Ideally, we’d preserve the original image data for users who want to
    // retain it but due to reports of data loss, we don’t want to overburden IndexedDB
    // by potentially doubling stored image data.
    // See: https://github.com/signalapp/Signal-Desktop/issues/1589
    const xcodedAttachment = {
      // `digest` is no longer valid for auto-oriented image data, so we discard it:
      ...omit(attachment, 'digest'),
      data: new Uint8Array(xcodedDataArrayBuffer),
      size: xcodedDataArrayBuffer.byteLength,
    };

    return xcodedAttachment;
  } catch (error: unknown) {
    const errorString = Errors.toLogFormat(error);
    logger.error(
      'autoOrientJPEG: Failed to rotate/scale attachment',
      errorString
    );

    return attachment;
  }
}
