// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';

import { scaleImageToLevel } from './scaleImageToLevel';
import { dropNull } from './dropNull';
import type {
  AttachmentType,
  UploadedAttachmentType,
} from '../types/Attachment';
import { canBeTranscoded } from '../types/Attachment';
import type { LoggerType } from '../types/Logging';
import * as MIME from '../types/MIME';
import * as Errors from '../types/errors';
import * as Bytes from '../Bytes';

// Upgrade steps NOTE: This step strips all EXIF metadata from JPEG images as part of
// re-encoding the image:

// When sending an image:
// 1. During composition, images are passed through handleImageAttachment. If needed, this
//    scales them down to high-quality (level 3).
// 2. Draft images are then written to disk as a draft image (so there is a `path`)
// 3. On send, the message schema is upgraded, triggering this function

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
  const { data, path, size } = attachment;

  if (sendHQImages) {
    return attachment;
  }
  let scaleTarget: string | Blob;
  if (data) {
    scaleTarget = new Blob([data], {
      type: attachment.contentType,
    });
  } else {
    if (!path) {
      return attachment;
    }
    scaleTarget = window.Signal.Migrations.getAbsoluteAttachmentPath(path);
  }

  try {
    const { blob: xcodedDataBlob } = await scaleImageToLevel(
      scaleTarget,
      attachment.contentType,
      size,
      isIncoming
    );
    const xcodedDataArrayBuffer = await blobToArrayBuffer(xcodedDataBlob);

    // IMPORTANT: We overwrite the existing `data` `Uint8Array` losing the original
    // image data. Ideally, we’d preserve the original image data for users who want to
    // retain it but due to reports of data loss, we don’t want to overburden IndexedDB
    // by potentially doubling stored image data.
    // See: https://github.com/signalapp/Signal-Desktop/issues/1589
    // We also clear out the attachment path because we're changing
    // the attachment data so it no longer matches the old path.
    // Path and data should always be in agreement.
    const xcodedAttachment = {
      ...attachment,
      data: new Uint8Array(xcodedDataArrayBuffer),
      size: xcodedDataArrayBuffer.byteLength,
      path: undefined,
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

export type CdnFieldsType = Pick<
  AttachmentType,
  'cdnId' | 'cdnKey' | 'cdnNumber' | 'key' | 'digest' | 'plaintextHash'
>;

export function copyCdnFields(
  uploaded?: UploadedAttachmentType
): CdnFieldsType {
  if (!uploaded) {
    return {};
  }
  return {
    cdnId: dropNull(uploaded.cdnId)?.toString(),
    cdnKey: uploaded.cdnKey,
    cdnNumber: dropNull(uploaded.cdnNumber),
    key: Bytes.toBase64(uploaded.key),
    digest: Bytes.toBase64(uploaded.digest),
    plaintextHash: uploaded.plaintextHash,
  };
}
