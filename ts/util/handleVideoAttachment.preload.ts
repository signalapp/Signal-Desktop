// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { blobToArrayBuffer } from 'blob-util';
import { sanitize } from '@signalapp/libsignal-client/dist/Mp4Sanitizer.js';
import { v4 as generateUuid } from 'uuid';

import { makeVideoScreenshot } from '../types/VisualAttachment.dom.js';
import { IMAGE_PNG, stringToMIMEType } from '../types/MIME.std.js';
import { toLogFormat } from '../types/errors.std.js';
import type { InMemoryAttachmentDraftType } from '../types/Attachment.std.js';
import { createLogger } from '../logging/log.std.js';
import { MemoryStream } from './MemoryStream.node.js';
import { fileToBytes } from './fileToBytes.std.js';

const log = createLogger('handleVideoAttachment');

export async function handleVideoAttachment(
  file: File,
  options: {
    generateScreenshot: boolean;
    flags: number | null;
  }
): Promise<InMemoryAttachmentDraftType> {
  const objectUrl = URL.createObjectURL(file);
  if (!objectUrl) {
    throw new Error('Failed to create object url for video!');
  }
  try {
    let data = await fileToBytes(file);

    if (file.type === 'video/mp4') {
      try {
        const result = await sanitize(
          new MemoryStream(data),
          BigInt(data.byteLength)
        );
        const metadata = result.getMetadata();

        // If there is no metadata - mp4 is already in the fast state!
        if (metadata != null) {
          const dataLen = Number(result.getDataLen());
          const dataOffset = Number(result.getDataOffset());
          const sanitized = new Uint8Array(dataLen + metadata.byteLength);
          sanitized.set(metadata, 0);
          sanitized.set(
            data.subarray(dataOffset, dataOffset + dataLen),
            metadata.byteLength
          );

          data = sanitized;
        }
      } catch (error) {
        log.warn(`Failed to mp4san video ${toLogFormat(error)}`);
      }
    }

    const attachment: InMemoryAttachmentDraftType = {
      contentType: stringToMIMEType(file.type),
      clientUuid: generateUuid(),
      data,
      fileName: file.name,
      path: file.name,
      pending: false,
      size: data.byteLength,
    };

    if (options.generateScreenshot) {
      const screenshotContentType = IMAGE_PNG;

      const { blob: screenshotBlob, duration } = await makeVideoScreenshot({
        objectUrl,
        contentType: screenshotContentType,
      });
      attachment.duration = duration;
      attachment.screenshotData = new Uint8Array(
        await blobToArrayBuffer(screenshotBlob)
      );
      attachment.screenshotContentType = screenshotContentType;
    }

    if (options.flags != null) {
      attachment.flags = options.flags;
    }

    return attachment;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
